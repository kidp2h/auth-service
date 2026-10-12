export class RefreshToken {
  constructor(
    public readonly id: string,
    public readonly accountId: string,
    // All tokens issued from one login share a family; reuse of a rotated
    // token revokes the whole family.
    public readonly familyId: string,
    public readonly tokenHash: string,
    public readonly expiresAt: Date,
    public readonly revokedAt: Date | null,
    public readonly replacedBy: string | null,
  ) {}
}
