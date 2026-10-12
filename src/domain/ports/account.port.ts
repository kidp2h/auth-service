import { Account } from '@domain/entities/account.entity';
import { DomainEvent } from '@domain/events/domain-event';

export interface IAccountPort {
  /** Case-insensitive lookup. */
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  /**
   * Inserts the account and the given events (outbox) in ONE transaction.
   * Throws AccountAlreadyExistsException when the email is taken, including
   * when a concurrent request wins the race.
   */
  createAccount(account: Account, events: DomainEvent[]): Promise<void>;
  /** Compensation for a failed cross-service step. */
  deleteById(id: string): Promise<void>;
}
