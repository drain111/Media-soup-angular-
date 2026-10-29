import { IsNotEmpty, IsString } from 'class-validator';

export class RoomJoinData {
  //Doing this just to keep form with the other dto.
  //i build this dtos and therefore I'm not passing them through a valdiationPipe, not needed.
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    name:string;

    
  constructor(user : string, email: string) {
    this.id = user;
    this.name = email;
  }
}
