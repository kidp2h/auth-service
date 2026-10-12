export class AuthResponseDto {
  constructor(
    public readonly accessToken: string,
    public readonly refreshToken: string,
    public readonly expiresIn: number, // access token lifetime in seconds
    public readonly user: { id: string; email: string; name: string },
  ) {}
}
