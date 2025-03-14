import { Test } from '@nestjs/testing';
import { RedisStreamsServer } from './redis-streams.server';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';

// Mock ioredis
const mockXgroup = jest.fn().mockResolvedValue('OK');
const mockXreadgroup = jest.fn().mockResolvedValue(null);
const mockQuit = jest.fn().mockResolvedValue(undefined);
const mockPing = jest.fn().mockResolvedValue('PONG');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    xgroup: mockXgroup,
    xreadgroup: mockXreadgroup,
    quit: mockQuit,
    ping: mockPing,
  }));
});

describe('RedisStreamsServer', () => {
  let server: RedisStreamsServer;

  beforeEach(async () => {
    const options: RedisStreamsOptions = {
      host: 'localhost',
      port: 6379,
      streamName: 'test-stream',
      groupName: 'test-group',
      consumerName: 'test-consumer',
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: RedisStreamsServer,
          useValue: new RedisStreamsServer(options),
        },
      ],
    }).compile();

    server = moduleRef.get<RedisStreamsServer>(RedisStreamsServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(server).toBeDefined();
  });

  it('should start listening', async () => {
    const initSpy = jest.spyOn(server as any, 'initializeConsumerGroup').mockResolvedValue(undefined);
    const consumeSpy = jest.spyOn(server as any, 'consume').mockImplementation(() => Promise.resolve());

    await new Promise<void>((resolve) => {
      server.listen(resolve);
    });

    expect(initSpy).toHaveBeenCalled();
    expect(consumeSpy).toHaveBeenCalled();
  });
});
