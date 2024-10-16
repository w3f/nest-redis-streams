import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { Observable, from } from 'rxjs';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
import { v4 as uuidv4 } from 'uuid';
const Redis = require('ioredis')

// TODO: Connection pool for consumer connections

interface ExtendedData<T> {
  payload: T;
  id?: string;
  responseStream?: string;
}

type RedisStreamMessage = [string, string[]];
type RedisStreamResponse = [string, RedisStreamMessage[]];

export class RedisStreamsClient extends ClientProxy {
  private client: typeof Redis;

  constructor(private options: RedisStreamsOptions) {
    super();
    this.client = new Redis({
      host: options.host,
      port: options.port,
    });
  }

  async connect(): Promise<any> {
    // Connection is established in the constructor
  }

  async close() {
    await this.client.quit();
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
   * @deprecated This method uses Redis Streams for synchronous-like communication, which is not recommended.
   * It may lead to performance issues, reduced scalability, and increased complexity.
   * 
   * Alternatives:
   * 1. Use the `emit` method for asynchronous communication with Redis Streams.
   * 2. Consider using the NestJS RabbitMQ transport for RPC-like functionality, as it has built-in support for request-response patterns.
   * 3. Implement a callback-based system with correlation IDs for request-response patterns if you must use Redis Streams.
   * 4. Use Redis pub/sub for simple request-response scenarios that don't require persistence.
   * 5. Use a different technology (e.g., gRPC, REST) for truly synchronous communication.
   * 
   * If you need RPC-like functionality in a message queue system, the RabbitMQ transport is a better choice as it supports this pattern natively and more efficiently.
   * 
   * This method will be removed in a future version.
   */
  send<TResult = any, TInput = any>(pattern: any, data: TInput): Observable<TResult> {
    const responseStream = `${this.options.streamName}:response:${uuidv4()}`;
    const requestId = uuidv4();
  
    const extendedData: ExtendedData<TInput> = {
      payload: data,
      id: requestId,
      responseStream,
    };
  
    return new Observable<TResult>((observer) => {
      this.dispatchEvent({ pattern, data: extendedData }).then(async () => {
        const consumer = new Redis({
          host: this.options.host,
          port: this.options.port,
        });
  
        const maxRetries = 5;
        const timeoutMs = 5000;
        try {
          for (let i = 0; i < maxRetries; i++) {
            const results = await consumer.xread('BLOCK', timeoutMs, 'STREAMS', responseStream, '$') as RedisStreamResponse[] | null;
            if (results && results.length > 0) {
              const [[, messages]] = results;
              for (const [, fields] of messages) {
                // Find the 'data' field in the message
                const dataField = fields.find((field: string, index: number) => index % 2 === 0 && field === 'data');
                if (dataField) {
                  const dataIndex = fields.indexOf(dataField) + 1;
                  const data = fields[dataIndex];
                  if (data) {
                    const response = JSON.parse(data);
                    if (response.id === requestId) {
                      observer.next(response.data);
                      observer.complete();
                      await consumer.xtrim(responseStream, 'MAXLEN', 0);
                      return;
                    }
                  }
                }
              }
            }
          }
          observer.error(new Error('No response received after maximum retries'));
        } catch (err) {
          // TODO: More granular error handling
          observer.error(err);
        } finally {
          await consumer.quit();
        }
      }).catch((err) => observer.error(err));
    });
  }
  
}
