import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException, NotFoundException, GoneException } from '@nestjs/common';
import { RedisRoomStore } from '../service/redis-room-store.service.js';
import { SessionUser } from '../domain/session-user.js';

@Injectable()
export class RedisGuard implements CanActivate {
  constructor(private readonly redisStore: RedisRoomStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ws = context.switchToWs();
    const socket = ws.getClient();
    const roomCode = ws.getData<string>();

    if (typeof roomCode !== 'string' || !roomCode) {
      throw new BadRequestException('Missing room code');
    }
    const user = socket.data.user as SessionUser;
    if (!user) throw new ForbiddenException('Not authenticated');

    const access = await this.redisStore.hasInvite(socket.data.user.loginKey, roomCode)
    if (!access.allowed) {
      if (access.reason === 'unknown')    throw new NotFoundException('Room not found');
      if (access.reason === 'expired')    throw new GoneException('Room expired'); // 410
      throw new ForbiddenException('Not invited to this session');
    }
    return true;
  }
}
