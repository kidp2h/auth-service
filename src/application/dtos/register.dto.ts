import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from './email.transform';

export class RegisterDto {
  @ApiProperty({
    example: 'nguyen.van.a@example.test',
    description: 'Case-insensitive; stored in lowercase.',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  // argon2 handles long inputs, but cap it to avoid hashing abuse.
  @ApiProperty({ example: 'MatKhau12345', minLength: 8, maxLength: 128 })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;
}
