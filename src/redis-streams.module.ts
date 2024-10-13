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
          provide: RedisStreamsClient,
          useValue: new RedisStreamsClient(options),
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
          provide: RedisStreamsClient,
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return new RedisStreamsClient(config);
          },
          inject: options.inject || [],
        },
      ],
      exports: [RedisStreamsClient],
    };
  }
}
