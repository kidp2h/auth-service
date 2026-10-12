import { ApiProperty } from '@nestjs/swagger';

// Shape produced by AllExceptionsFilter for every error.
export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  status!: number;

  @ApiProperty({ example: 'AUTH_INVALID_CREDENTIALS' })
  error!: string;

  @ApiProperty({ example: 'Invalid email or password.' })
  message!: string;
}
