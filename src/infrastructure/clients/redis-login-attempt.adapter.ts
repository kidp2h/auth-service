import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ILoginAttemptPort } from '@domain/ports/login-attempt.port';
import { AUTH_CONFIG } from '@/auth.constants';
import type { AuthConfig } from '@/auth.constants';

/**
 * Failed-login counters with a lock window, per email and per IP.
 * Per-email stops password guessing against one account; per-IP stops one
 * source from spraying many accounts. Trade-off: an attacker can lock a victim
 * out for `lockSeconds` by failing on purpose, which is why the lock is short.
 * Coarse rate limiting still belongs to the edge (Kong).
 */
@Injectable()
export class RedisLoginAttemptAdapter implements ILoginAttemptPort {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async lockedFor(email: string, ip: string): Promise<number> {
    const [emailCount, ipCount, emailTtl, ipTtl] = await Promise.all([
      this.redis.get(this.emailKey(email)),
      this.redis.get(this.ipKey(ip)),
      this.redis.ttl(this.emailKey(email)),
      this.redis.ttl(this.ipKey(ip)),
    ]);
    const waits: number[] = [];
    if (Number(emailCount) >= this.config.maxFailuresPerEmail) {
      waits.push(Math.max(emailTtl, 1));
    }
    if (Number(ipCount) >= this.config.maxFailuresPerIp) {
      waits.push(Math.max(ipTtl, 1));
    }
    return waits.length ? Math.max(...waits) : 0;
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    const pipeline = this.redis.multi();
    for (const key of [this.emailKey(email), this.ipKey(ip)]) {
      pipeline.incr(key);
      pipeline.expire(key, this.config.lockSeconds, 'NX');
    }
    await pipeline.exec();
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.emailKey(email));
  }

  private emailKey(email: string): string {
    return `login:fail:email:${email}`;
  }

  private ipKey(ip: string): string {
    return `login:fail:ip:${ip}`;
  }
}
