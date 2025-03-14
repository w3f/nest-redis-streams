import { Server, CustomTransportStrategy } from '@nestjs/microservices';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
const Redis = require('ioredis')


export class RedisStreamsServer extends Server implements CustomTransportStrategy {
  private client: typeof Redis | null = null;

  constructor(private readonly options: RedisStreamsOptions) {
    super();
  }

  async listen(callback: () => void) {
    this.client = new Redis({
      host: this.options.host,
      port: this.options.port,
    });
    
    await this.client.ping();
    
    await this.initializeConsumerGroup();
    this.consume().catch(err => console.error('Consume error:', err));
    callback();
  }

  private async initializeConsumerGroup() {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    
    try {
      await this.client.xgroup('CREATE', this.options.streamName, this.options.groupName, '$', 'MKSTREAM');
    } catch (err) {
      if (err instanceof Error && err.message !== 'BUSYGROUP Consumer Group name already exists') {
        throw err;
      }
    }
  }  

  private async consume() {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    
    while (true) {
      const results = await this.client.xreadgroup(
        'GROUP', this.options.groupName, this.options.consumerName,
        'COUNT', '100',
        'BLOCK', '1000', // Timeout to prevent busy waiting
        'STREAMS', this.options.streamName, '>'
      );

      if (results) {
        const [streamResults] = results;
        if (Array.isArray(streamResults) && streamResults.length > 1) {
          const [, messages] = streamResults;
          for (const [messageId, [, pattern, , data]] of messages) {
            const parsedData = JSON.parse(data);
            await this.handleMessage(pattern, parsedData, messageId);
          }
        }
      }
    }
  }

  private async handleMessage(pattern: string, data: any, messageId: string) {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    
    const handler = this.messageHandlers.get(pattern);
    if (handler) {
      await handler(data);
      await this.client.xack(this.options.streamName, this.options.groupName, messageId);
    } else {
      console.warn(`No handler found for pattern: ${pattern}`);
    }
  }

  close() {
    if (this.client) {
      this.client.quit();
      this.client = null;
    }
  }
}
