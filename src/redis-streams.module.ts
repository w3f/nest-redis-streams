import { DynamicModule, Module } from '@nestjs/common';
import { RedisStreamsClient } from './client/redis-streams.client';
import { RedisStreamsOptions } from './interfaces/redis-streams-options';

@Module({})
export class RedisStreamsModule {
  static register(options: RedisStreamsOptions): DynamicModule {
    return {
      module: RedisStreamsModule,
      providers: [
        {
          provide: 'REDIS_STREAMS_OPTIONS',
          useValue: options,
        },
        {
          provide: RedisStreamsClient,
          useFactory: async (redisOptions: RedisStreamsOptions) => {
            const client = new RedisStreamsClient(redisOptions);
            await client.connect();
            return client;
          },
          inject: ['REDIS_STREAMS_OPTIONS'],
        },
      ],
      exports: [RedisStreamsClient],
    };
  }

  static registerAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<RedisStreamsOptions> | RedisStreamsOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: RedisStreamsModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'REDIS_STREAMS_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: RedisStreamsClient,
          useFactory: async (redisOptions: RedisStreamsOptions) => {
            const client = new RedisStreamsClient(redisOptions);
            await client.connect();
            return client;
          },
          inject: ['REDIS_STREAMS_OPTIONS'],
        },
      ],
      exports: [RedisStreamsClient],
    };
  }
}
