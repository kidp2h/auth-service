import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: '35f59547-5288-4a13-9a4d-36e3949b638e' })
  id: string;

  @ApiProperty({ example: 'nguyen.van.a@example.test' })
  email: string;

  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Empty on login and refresh; only register knows the name.',
  })
  name: string;

  constructor(id: string, email: string, name: string) {
    this.id = id;
    this.email = email;
    this.name = name;
  }
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (RS256), valid for `expiresIn` seconds.',
  })
  readonly accessToken: string;

  @ApiProperty({
    description:
      'Opaque refresh token, single use (rotated by POST /auth/refresh).',
  })
  readonly refreshToken: string;

  @ApiProperty({
    example: 900,
    description: 'Access token lifetime in seconds.',
  })
  readonly expiresIn: number;

  @ApiProperty({ type: AuthUserDto })
  readonly user: AuthUserDto;

  constructor(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    user: { id: string; email: string; name: string },
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresIn = expiresIn;
    this.user = user;
  }
}
