import { Test } from '@nestjs/testing';
import { RedisStreamsClient } from './redis-streams.client';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
import { lastValueFrom } from 'rxjs';

const mockXadd = jest.fn().mockResolvedValue('ok');
const mockXread = jest.fn();
const mockXtrim = jest.fn().mockResolvedValue(0);
const mockQuit = jest.fn().mockResolvedValue(undefined);
const mockPing = jest.fn().mockResolvedValue('PONG');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    xadd: mockXadd,
    xread: mockXread,
    xtrim: mockXtrim,
    quit: mockQuit,
    ping: mockPing,
  }));
});

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('RedisStreamsClient', () => {
  let client: RedisStreamsClient;

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
          provide: RedisStreamsClient,
          useValue: new RedisStreamsClient(options),
        },
      ],
    }).compile();

    client = moduleRef.get<RedisStreamsClient>(RedisStreamsClient);
  });

  afterEach(async () => {
    await client.close();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('should publish a message', async () => {
    const pattern = 'test-pattern';
    const data = { message: 'Hello, Redis Streams!' };
  
    await expect(lastValueFrom(client.emit(pattern, data))).resolves.toBe('ok');
    expect(mockXadd).toHaveBeenCalledWith(
      'test-stream',
      '*',
      'pattern', pattern,
      'data', JSON.stringify(data),
      'id', '',
      'responseStream', ''
    );
  });
  
  it('should throw an error when using send method', async () => {
    const pattern = 'test-pattern';
    const data = { message: 'Hello, Redis Streams!' };

    await expect(lastValueFrom(client.send(pattern, data))).rejects.toThrow(
      'The send method is not supported. Redis Streams is used only for asynchronous communication in this implementation.'
    );
  });
});
