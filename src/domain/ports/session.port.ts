import { AccountSession } from '@domain/entities/account-session.entity';

export interface ISessionPort {
  saveSession(session: AccountSession): Promise<void>;
  findSessionById(id: string): Promise<AccountSession | null>;
  revokeSession(id: string): Promise<void>;
  isTokenBlacklisted(id: string): Promise<boolean>;
}
