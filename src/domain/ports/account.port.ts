import { Account } from '@domain/entities/account.entity';

export interface IAccountPort {
  findByEmail(email: string): Promise<Account | null>;
  createAccount(
    email: string,
    passwordHash: string,
    userId?: string | null,
  ): Promise<Account>;
  updateAccount(account: Account): Promise<Account>;
}
