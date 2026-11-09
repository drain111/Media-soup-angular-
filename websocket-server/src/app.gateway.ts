import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthGuard } from './guards/auth.guard.js';
import { Logger, UseGuards } from '@nestjs/common';
import { RedisGuard } from './guards/redis.guard.js';
import { RoomJoinData } from './dto/roomJoin.dto.js';
import { SessionUser } from './domain/session-user.js';
@WebSocketGateway()
export class AppGateway implements OnGatewayInit, OnGatewayDisconnect {
  constructor(
    private readonly auth: AuthGuard,
  ) {}
  
  private logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  @UseGuards(RedisGuard)
  @SubscribeMessage('joinRoom')
  async handleJoin(
    @MessageBody() roomCode: string,
    @ConnectedSocket() socket: Socket,
  ): Promise<RoomJoinData & { count: number }> {
    //TODO in the future when I say we do, send here the necessary data to connect to mediasoup
    void socket.join(roomCode);
    socket.data.room = roomCode;
    // allSockets() includes this socket — count is the total including the joiner.
    const count = (await this.server.in(roomCode).fetchSockets()).length;
    const user = socket.data.user as SessionUser;

    const name = user.name ?? user.loginKey;

    // Notify the rest of the room that someone joined.
    socket.to(roomCode).emit('joinedRoom', [new RoomJoinData(socket.id, name)]);
    // Ack carries id, name and the current headcount back to the joiner in one call.
    return {
      id: socket.data.user.id,
      name: name,
      count,
    };
  }

  handleDisconnect(socket: Socket): void {
    const room = socket.data.room as string | undefined;
    if (!room) return;
    socket.data.room = undefined;
    void socket.leave(room);
    // Notify the remaining sockets of the new headcount.
    socket.to(room).emit('leftRoom', socket.id);
  }

  afterInit() {
    this.server.use(async (socket: Socket, next) => {
      const token = this.auth.getToken(socket)
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
