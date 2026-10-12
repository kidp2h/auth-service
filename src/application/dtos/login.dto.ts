import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { NormalizeEmail } from './email.transform';

// Not derived from RegisterDto: the password length rule applies to new
// passwords only, existing accounts created under the old rule must still log in.
export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
