# NestJS Redis Streams

A Redis Streams transport implementation for NestJS microservices. This package provides a seamless integration of Redis Streams with NestJS, allowing you to build scalable and robust microservices using Redis as a message broker.

## Features

- Persistent message storage using Redis Streams
- Consumer groups for load balancing and fault tolerance
- Compatible with NestJS microservices patterns and decorators
- Supports both event-based and request-response communication patterns
- Easy integration with existing NestJS applications

## Installation

```bash
yarn add @w3f/nest-redis-streams
```

## Installation

### Registering the module

```
import { Module } from '@nestjs/common';
import { RedisStreamsModule } from '@w3f/nest-redis-streams';

@Module({
  imports: [
    RedisStreamsModule.register({
      host: 'localhost',
      port: 6379,
      streamName: 'my-stream',
      groupName: 'my-group',
      consumerName: 'consumer-1',
    }),
  ],
})
export class AppModule {}
```

### Using the client to publish messages

```
import { Injectable } from '@nestjs/common';
import { RedisStreamsClient } from '@w3f/nest-redis-streams';

@Injectable()
export class PublisherService {
  constructor(private readonly client: RedisStreamsClient) {}

  async publishMessage(pattern: string, data: any) {
    await this.client.emit(pattern, data).toPromise();
  }
}
```

### Creating a microservice consumer

```
import { NestFactory } from '@nestjs/core';
import { RedisStreamsServer } from '@w3f/nest-redis-streams';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    strategy: new RedisStreamsServer({
      host: 'localhost',
      port: 6379,
      streamName: 'my-stream',
      groupName: 'my-group',
      consumerName: 'consumer-1',
    }),
  });

  await app.listen();
}
bootstrap();
```

### Handling events in a controller

```
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

@Controller()
export class EventsController {
  @EventPattern('user.created')
  handleUserCreated(data: any) {
    console.log('User created:', data);
    // Process the event
  }

  @EventPattern('order.placed')
  handleOrderPlaced(data: any) {
    console.log('Order placed:', data);
    // Process the event
  }
}
```
