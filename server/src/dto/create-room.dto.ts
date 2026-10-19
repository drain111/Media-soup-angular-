import { IsString, IsArray } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  roomName: string;

  @IsArray()
  inviteEmails?: string[];
}
