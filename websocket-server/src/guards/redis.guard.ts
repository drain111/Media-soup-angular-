import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RedisRoomStore } from '../service/redis-room-store.service.js';
import { SessionUser } from '../domain/sessionUser.js';

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

    const room = await this.redisStore.get(roomCode);
    if (!room) throw new ForbiddenException('Room not found');
    //this shouldn't triger, but who knows, jsut in case
    if (Date.now() / 1000 > room.expiresAt) throw new ForbiddenException('Room expired');

    const user = socket.data.user as SessionUser;
    if (!user) throw new ForbiddenException('Not authenticated');

    const isHost = user.id === room.hostParticipantId;
    const isInvited = room.invites.has(user.id);

    if (!isHost && !isInvited) throw new ForbiddenException('Not allowed in this room');
    return true;
  }
}
