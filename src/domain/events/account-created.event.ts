import { randomUUID } from 'crypto';
import { DomainEvent } from './domain-event';

export const ACCOUNT_CREATED_TOPIC = 'account.created';

export interface AccountCreatedData {
  accountId: string;
  email: string;
  name: string;
}

// Additive changes only; breaking changes need a new topic (account.created.v2).
export function accountCreated(
  data: AccountCreatedData,
): DomainEvent<AccountCreatedData> {
  return {
    eventId: randomUUID(),
    eventType: 'account.created',
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateId: data.accountId,
    topic: ACCOUNT_CREATED_TOPIC,
    data,
  };
}
