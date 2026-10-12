// Pure domain object: no framework or persistence imports. Mapping to the
// `accounts` table lives in infrastructure/database/entities.
export class Account {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
  ) {}
}
