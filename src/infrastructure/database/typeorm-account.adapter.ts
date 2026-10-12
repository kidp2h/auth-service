import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { context, propagation } from '@opentelemetry/api';
import { Account } from '@domain/entities/account.entity';
import { IAccountPort } from '@domain/ports/account.port';
import { DomainEvent } from '@domain/events/domain-event';
import { AccountAlreadyExistsException } from '@domain/exceptions/account-already-exists.exception';
import { AccountOrmEntity } from './entities/account.orm-entity';
import { OutboxOrmEntity } from './entities/outbox.orm-entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmAccountAdapter implements IAccountPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByEmail(email: string): Promise<Account | null> {
    const row = await this.dataSource
      .getRepository(AccountOrmEntity)
      .createQueryBuilder('a')
      .where('lower(a.email) = lower(:email)', { email })
      .getOne();
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.dataSource
      .getRepository(AccountOrmEntity)
      .findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async createAccount(account: Account, events: DomainEvent[]): Promise<void> {
    try {
      await this.dataSource.transaction(async (em) => {
        await em.insert(AccountOrmEntity, {
          id: account.id,
          email: account.email,
          passwordHash: account.passwordHash,
        });
        if (events.length > 0) {
          const headers = this.traceHeaders();
          await em.insert(
            OutboxOrmEntity,
            events.map((e) => ({
              eventId: e.eventId,
              aggregateId: e.aggregateId,
              eventType: e.eventType,
              topic: e.topic,
              payload: {
                eventId: e.eventId,
                eventType: e.eventType,
                version: e.version,
                occurredAt: e.occurredAt,
                aggregateId: e.aggregateId,
                data: e.data as Record<string, unknown>,
              },
              headers: {
                ...headers,
                eventId: e.eventId,
                eventType: e.eventType,
                version: String(e.version),
              },
            })),
          );
        }
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new AccountAlreadyExistsException(account.email);
      }
      throw error;
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.dataSource.getRepository(AccountOrmEntity).delete({ id });
  }

  private toDomain(row: AccountOrmEntity): Account {
    return new Account(row.id, row.email, row.passwordHash);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        PG_UNIQUE_VIOLATION
    );
  }

  // W3C trace context stored with the event, so the consumer's span links back
  // to the register request even though it runs later.
  private traceHeaders(): Record<string, string> {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    return carrier;
  }
}
