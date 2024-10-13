import { Server, CustomTransportStrategy } from '@nestjs/microservices';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
const Redis = require('ioredis')

export class RedisStreamsServer extends Server implements CustomTransportStrategy {
  private client: typeof Redis;

  constructor(private options: RedisStreamsOptions) {
    super();
    this.client = new Redis({
      host: options.host,
      port: options.port,
    });
  }

  async listen(callback: () => void) {
    await this.initializeConsumerGroup();
    this.consume().catch(err => console.error('Consume error:', err));
    callback();
  }

  private async initializeConsumerGroup() {
    try {
      await this.client.xgroup('CREATE', this.options.streamName, this.options.groupName, '$', 'MKSTREAM');
    } catch (err) {
      if (err instanceof Error && err.message !== 'BUSYGROUP Consumer Group name already exists') {
        throw err;
      }
    }
  }  

  private async consume() {
    while (true) {
      try {
        const results = await this.client.xreadgroup(
          'GROUP', this.options.groupName, this.options.consumerName,
          'COUNT', '1',
          'BLOCK', '0',
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
      } catch (err) {
        console.error('Error consuming message:', err);
      }
    }
  }

  private async handleMessage(pattern: string, data: any, messageId: string) {
    const handler = this.messageHandlers.get(pattern);
    if (handler) {
      try {
        await handler(data);
        await this.client.xack(this.options.streamName, this.options.groupName, messageId);
      } catch (err) {
        console.error('Error processing message:', err);
      }
    } else {
      console.warn(`No handler found for pattern: ${pattern}`);
    }
  }

  close() {
    this.client.quit();
  }
}
