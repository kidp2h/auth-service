import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { AccountSession } from '@domain/entities/account-session.entity';
import { ISessionPort } from '@domain/ports/session.port';

@Injectable()
export class RedisSessionAdapter implements ISessionPort {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private getSessionKey(id: string): string {
    return `session:${id}`;
  }

  async saveSession(session: AccountSession): Promise<void> {
    const key = this.getSessionKey(session.id);
    const ttlSeconds = Math.max(
      1,
      Math.floor((session.expiresAt - Date.now()) / 1000),
    );

    await this.redis.set(key, JSON.stringify(session), 'EX', ttlSeconds);
  }

  async findSessionById(id: string): Promise<AccountSession | null> {
    const data = await this.redis.get(this.getSessionKey(id));
    if (!data) {
      return null;
    }
    const raw = JSON.parse(data);
    return new AccountSession(
      raw.id,
      raw.accountId,
      raw.ipAddress,
      raw.device,
      raw.isRevoked,
      raw.expiresAt,
    );
  }

  async revokeSession(id: string): Promise<void> {
    const session = await this.findSessionById(id);
    if (session) {
      const revokedSession = new AccountSession(
        session.id,
        session.accountId,
        session.ipAddress,
        session.device,
        true,
        session.expiresAt,
      );
      await this.saveSession(revokedSession);
    }
  }

  async isTokenBlacklisted(id: string): Promise<boolean> {
    const session = await this.findSessionById(id);
    return session ? session.isRevoked : true; // Expired or missing sessions are treated as blacklisted (unusable)
  }
}
