import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { NormalizeEmail } from './email.transform';

// Not derived from RegisterDto: the password length rule applies to new
// passwords only, existing accounts created under the old rule must still log in.
export class LoginDto {
  @ApiProperty({ example: 'nguyen.van.a@example.test' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({ example: 'MatKhau12345' })
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
