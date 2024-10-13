import { SetMetadata } from '@nestjs/common';

export const REDIS_STREAM_EVENT = 'REDIS_STREAM_EVENT';

export const RedisStreamEvent = (pattern: string) => SetMetadata(REDIS_STREAM_EVENT, pattern);
