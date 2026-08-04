export class AccountSession {
  constructor(
    public readonly id: string, // JWT unique identifier (jti)
    public readonly accountId: string,
    public readonly ipAddress: string,
    public readonly device: string,
    public readonly isRevoked: boolean,
    public readonly expiresAt: number, // expiration timestamp in milliseconds
  ) {}
}
