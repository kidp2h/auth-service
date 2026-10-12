import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from './email.transform';

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  // argon2 handles long inputs, but cap it to avoid hashing abuse.
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  password!: string;

  @IsNotEmpty({ message: 'Name is required' })
  name!: string;
}
