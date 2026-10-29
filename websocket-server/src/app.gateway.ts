import { WebSocketGateway, WebSocketServer, OnGatewayInit, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthGuard } from './guards/auth.guard.js';
import { RedisRoomStore } from './service/redis-room-store.service.js';
import { UseGuards } from '@nestjs/common';
import {RedisGuard} from './guards/redis.guard.js'
import { RoomJoinData } from './dto/roomJoin.dto.js';
@WebSocketGateway()
export class AppGateway implements OnGatewayInit {
  constructor(
    private readonly auth: AuthGuard,
  ) {}

  @WebSocketServer()
  server: Server;

  @UseGuards(RedisGuard)
  @SubscribeMessage('joinRoom')
  handleMessage(@MessageBody() roomCode: string, @ConnectedSocket() socket: Socket,): void {
    //TODO in the future when I say we do, send here the necessary data to connect to mediasoup and will be managed to send to every other client
      // 1. Put the socket into the room namespace
    socket.join(roomCode);
  const userData = new RoomJoinData(socket.data.user.id, socket.data.user.name ?? socket.data.user.email);    this.server.to(roomCode).emit('joinedRoom', userData);
  }
  afterInit() {
    this.server.use(async (socket: Socket, next) => {
      const token =
        (socket.handshake.auth as Record<string, string> | undefined)?.token ??
        (socket.handshake.query as Record<string, string>)?.token;

      if (!token) {
        next(new Error('Missing token'));
        return;
      }

        const result = await this.auth.verify(token);
        if (!result) {
          next(new Error("Log in error"));
          return;
        }
        socket.data.user = result; // single object, matches SessionUser
        next();
      
    });

   
  }
}
