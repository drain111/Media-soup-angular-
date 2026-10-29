import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RedisGuard } from './guards/redis.guard.js';
import { RedisRoomStore } from './service/redis-room-store.service.js';

@Module({
  imports: [],
  controllers: [],
  providers: [AppGateway, AuthGuard, RedisGuard, RedisRoomStore],
})
export class AppModule {}