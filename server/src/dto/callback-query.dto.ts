import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Query string the OAuth provider sends back. Extra params (scope, authuser...) are stripped. */
export class CallbackQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  state!: string;
}
