import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Observable, from } from 'rxjs';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
import { v4 as uuidv4 } from 'uuid';
const Redis = require('ioredis')


interface ExtendedData<T> {
  payload: T;
  id?: string;
  responseStream?: string;
}

type RedisStreamMessage = [string, string[]];
type RedisStreamResponse = [string, RedisStreamMessage[]];

export class RedisStreamsClient extends ClientProxy {
  private client: typeof Redis | null = null;

  constructor(private readonly options: RedisStreamsOptions) {
    super();
  }

  async connect(): Promise<any> {
    if (this.client) {
      return;
    }
    
    this.client = new Redis({
      host: this.options.host,
      port: this.options.port,
    });
    
    try {
      await this.client.ping();
    } catch (err) {
      this.client = null;
      throw err;
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  publish(packet: ReadPacket<any>, callback: (packet: WritePacket<any>) => void): () => void {
    this.dispatchEvent(packet)
      .then(() => callback({ response: null }))
      .catch((err) => callback({ err }));
    return () => {};
  }

  async publishAsync(packet: ReadPacket<any>): Promise<WritePacket<any>> {
    await this.dispatchEvent(packet);
    return { response: null };
  }

  emit<TResult = any, TInput = any>(pattern: any, data: TInput): Observable<TResult> {
    return from(this.dispatchEvent({ pattern, data: { payload: data } }));
  }
  
  async dispatchEvent(packet: ReadPacket<any>): Promise<any> {
    if (!this.client) {
      await this.connect();
    }
    
    const { pattern, data } = packet;
    const extendedData = data as ExtendedData<any>;
    return this.client.xadd(
      this.options.streamName,
      '*',
      'pattern', pattern,
      'data', JSON.stringify(extendedData.payload),
      'id', extendedData.id || '',
      'responseStream', extendedData.responseStream || ''
    );
  }
  
  /**
   * @deprecated This method is not supported. Redis Streams is used only for asynchronous communication in this implementation.
   * 
   * Alternatives:
   * 1. Use the `emit` method for asynchronous communication with Redis Streams.
   * 2. Consider using the NestJS RabbitMQ transport for RPC-like functionality, as it has built-in support for request-response patterns.
   * 3. Use a different technology (e.g., gRPC, REST) for synchronous communication.
   */
  send<TResult = any, TInput = any>(pattern: any, data: TInput): Observable<TResult> {
    return new Observable<TResult>((observer) => {
      observer.error(new Error('The send method is not supported. Redis Streams is used only for asynchronous communication in this implementation.'));
    });
  }
  
}
