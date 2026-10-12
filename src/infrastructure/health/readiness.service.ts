import { BeforeApplicationShutdown, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, 'up' | 'down'>;
}

const CHECK_TIMEOUT_MS = 1000;
const CACHE_TTL_MS = 3000;

/**
 * Hard dependencies only: Postgres (accounts) and Redis (sessions). Kafka and
 * other services are deliberately not checked, so their outage cannot make
 * every replica unready. Results are cached briefly so that probes from many
 * pods do not turn into load on the database.
 */
@Injectable()
export class ReadinessService implements BeforeApplicationShutdown {
  private shuttingDown = false;
  private cached?: { at: number; report: ReadinessReport };
  private inFlight?: Promise<ReadinessReport>;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // Fail readiness first on SIGTERM so the pod leaves the Service endpoints
  // while in-flight requests finish.
  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  async check(): Promise<ReadinessReport> {
    if (this.shuttingDown) {
      return { ready: false, checks: { shutdown: 'down' } };
    }
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.report;
    }
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async run(): Promise<ReadinessReport> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.dataSource.query('SELECT 1')),
      this.probe(() => this.redis.ping()),
    ]);
    const report: ReadinessReport = {
      ready: database === 'up' && redis === 'up',
      checks: { database, redis },
    };
    this.cached = { at: Date.now(), report };
    return report;
  }

  private async probe(fn: () => Promise<unknown>): Promise<'up' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('health check timed out')),
        CHECK_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([fn(), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
