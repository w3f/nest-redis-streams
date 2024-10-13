import { Test } from '@nestjs/testing';
import { RedisStreamsClient } from './redis-streams.client';
import { RedisStreamsOptions } from '../interfaces/redis-streams-options';
import { lastValueFrom } from 'rxjs';

const mockXadd = jest.fn().mockResolvedValue('ok');
const mockXread = jest.fn();
const mockXtrim = jest.fn().mockResolvedValue(0);
const mockQuit = jest.fn().mockResolvedValue(undefined);

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    xadd: mockXadd,
    xread: mockXread,
    xtrim: mockXtrim,
    quit: mockQuit,
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
  
  it('should send a message and receive a response', async () => {
    const pattern = 'test-pattern';
    const data = { message: 'Hello, Redis Streams!' };
    const responseData = { result: 'Success' };

    mockXread.mockResolvedValueOnce([
      [
        'test-stream:response:mocked-uuid',
        [['1-0', ['data', JSON.stringify({ id: 'mocked-uuid', data: responseData })]]]
      ]
    ]);

    const result = await lastValueFrom(client.send(pattern, data));

    expect(result).toEqual(responseData);
    expect(mockXadd).toHaveBeenCalledWith(
      'test-stream',
      '*',
      'pattern', pattern,
      'data', JSON.stringify(data),
      'id', 'mocked-uuid',
      'responseStream', 'test-stream:response:mocked-uuid'
    );
    expect(mockXread).toHaveBeenCalledWith(
      'BLOCK',
      5000,
      'STREAMS',
      'test-stream:response:mocked-uuid',
      '$'
    );
    expect(mockXtrim).toHaveBeenCalledWith('test-stream:response:mocked-uuid', 'MAXLEN', 0);
    
    // Wait for any pending promises to resolve
    await new Promise(process.nextTick);
    
    expect(mockQuit).toHaveBeenCalled();
  });
  
  it('should throw an error after max retries', async () => {
    const pattern = 'test-pattern';
    const data = { message: 'Hello, Redis Streams!' };

    mockXread.mockResolvedValue(null);

    await expect(lastValueFrom(client.send(pattern, data))).rejects.toThrow(
      'No response received after maximum retries'
    );

    expect(mockXread).toHaveBeenCalledTimes(5);
    expect(mockQuit).toHaveBeenCalled();
  });

  it('should handle errors during send', async () => {
    const pattern = 'test-pattern';
    const data = { message: 'Hello, Redis Streams!' };

    mockXread.mockRejectedValue(new Error('Redis error'));

    await expect(lastValueFrom(client.send(pattern, data))).rejects.toThrow('Redis error');

    expect(mockXread).toHaveBeenCalledTimes(1);
    expect(mockQuit).toHaveBeenCalled();
  });
});
