import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refreshToken returned by login or register.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
