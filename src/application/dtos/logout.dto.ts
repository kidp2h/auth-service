import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'If sent, the whole refresh token family is revoked too, so the session cannot be renewed.',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
