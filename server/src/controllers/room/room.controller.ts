import { Body, Controller, HttpStatus, Post, Get, UseGuards, Logger, Param } from '@nestjs/common';
import { ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { generateRoomCode } from '../../utils/utils.js';
import { REDIS_SESSION_TTL_SECONDS, RedisSessionStore } from '../../services/redis-store.service.js';
import { SessionGuard } from '../../guards/session.guard.js';
import { CurrentUser } from '../../guards/current-user.decorator.js';
import type { SessionUser } from '../../domain/session-user.js';
import { CreateRoomDto } from '../../dto/create-room.dto.js';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

export const CREATE_ROOM_RETRIES = 5;

@Controller('rooms')
@UseInterceptors(ClassSerializerInterceptor)
export class RoomController {
  private logger = new Logger(RoomController.name);

  constructor(readonly redis: RedisSessionStore) {}

  @Post()
  @UseGuards(SessionGuard)
  async createRoom(@CurrentUser() user: SessionUser, @Body() dto: CreateRoomDto): Promise<{ code: string }> {
    let code: string | undefined;
    for (let attemptNum = 0; attemptNum < CREATE_ROOM_RETRIES; attemptNum++) {
      code = generateRoomCode();
      const existing = await this.redis.get(code);
      if (!existing) break;
      code = undefined; // collision — retry
    }

    if (!code) throw new Error('Could not create room after ' + CREATE_ROOM_RETRIES + ' tries');

    const sessionId = `${user.id}@${Date.now()}`;
    const expiresAt = Math.floor(Date.now() / 1000) + REDIS_SESSION_TTL_SECONDS;
    await this.redis.create(
      sessionId,
      { code, hostParticipantId: user.id, expiresAt, roomName: dto.roomName },
      dto.inviteEmails ?? [],
      REDIS_SESSION_TTL_SECONDS,
    );

    return { code };
  }

  @Get(':code')
  @UseGuards(SessionGuard)
  async checkRoomAccess(
    @Param('code') code: string,
    @CurrentUser() user: SessionUser,
  ): Promise<{ allowed: boolean; roomName?: string }> {
    const room = await this.redis.get(code);
    if (!room || room.expiresAt < Math.floor(Date.now() / 1000)) {
      throw new NotFoundException('Room not found or expired');
    }

    // Host check
    if (user.id === room.hostParticipantId) return { allowed: true, roomName: room.roomName };

    // Invite check
    const isInvited = room.invites.has(user.email);
    if (!isInvited) {
      throw new ForbiddenException('Not invited to this session');
    }

    return { allowed: true, roomName: room.roomName };
  }
}
