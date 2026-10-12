import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { MetricsService } from '@infrastructure/observability/metrics.service';

interface OutboxRow {
  id: string;
  event_id: string;
  aggregate_id: string;
  topic: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
}

const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 1000;
const RETENTION_DAYS = 7;

/**
 * Transactional outbox relay: moves rows from the `outbox` table to Kafka.
 *
 * Delivery is at-least-once (a crash after sending but before the UPDATE
 * re-sends the batch), so consumers must dedupe by eventId. Rows are locked
 * with FOR UPDATE SKIP LOCKED, so several replicas can relay in parallel.
 * Messages are keyed by aggregate id, which keeps per-account ordering inside
 * a partition. Only active when PROFILE_SYNC_MODE=event.
 */
@Injectable()
export class OutboxRelayService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxRelayService.name);
  private producer?: Producer;
  private timer?: NodeJS.Timeout;
  private stopping = false;
  private lastCleanup = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('PROFILE_SYNC_MODE') !== 'event') {
      return;
    }
    const brokers = (this.config.get<string>('KAFKA_BROKERS') ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    const kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID') ?? 'auth-service',
      brokers,
      logLevel: logLevel.WARN,
    });
    this.producer = kafka.producer({
      idempotent: true,
      allowAutoTopicCreation: false,
    });
    this.schedule();
    this.logger.log(`Outbox relay started, brokers: ${brokers.join(',')}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.timer);
    await this.producer?.disconnect().catch(() => undefined);
  }

  private schedule(): void {
    if (this.stopping) {
      return;
    }
    this.timer = setTimeout(() => void this.tick(), POLL_INTERVAL_MS);
  }

  private async tick(): Promise<void> {
    try {
      let relayed: number;
      do {
        relayed = await this.relayBatch();
      } while (relayed === BATCH_SIZE && !this.stopping);
      await this.refreshMetrics();
      await this.cleanup();
    } catch (error) {
      // Kafka or DB trouble: rows stay in the outbox and are retried next tick.
      this.logger.error(
        `Outbox relay failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.schedule();
    }
  }

  private async relayBatch(): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      const rows: OutboxRow[] = await em.query(
        `SELECT id, event_id, aggregate_id, topic, payload, headers
           FROM outbox
          WHERE published_at IS NULL
          ORDER BY id
          LIMIT $1
            FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );
      if (rows.length === 0) {
        return 0;
      }

      await this.producer!.connect(); // no-op when already connected
      const byTopic = new Map<string, OutboxRow[]>();
      for (const row of rows) {
        byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);
      }
      await this.producer!.sendBatch({
        acks: -1,
        topicMessages: [...byTopic.entries()].map(([topic, list]) => ({
          topic,
          messages: list.map((r) => ({
            key: r.aggregate_id,
            value: JSON.stringify(r.payload),
            headers: r.headers,
          })),
        })),
      });

      await em.query(
        `UPDATE outbox SET published_at = now() WHERE id = ANY($1::bigint[])`,
        [rows.map((r) => r.id)],
      );
      return rows.length;
    });
  }

  private async refreshMetrics(): Promise<void> {
    const [row] = await this.dataSource.query(
      `SELECT count(*)::int AS pending,
              COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at))), 0)::float AS oldest
         FROM outbox WHERE published_at IS NULL`,
    );
    this.metrics.outboxPending.set(row.pending);
    this.metrics.outboxOldestAgeSeconds.set(row.oldest);
  }

  private async cleanup(): Promise<void> {
    if (Date.now() - this.lastCleanup < 3_600_000) {
      return;
    }
    this.lastCleanup = Date.now();
    await this.dataSource.query(
      `DELETE FROM outbox WHERE published_at < now() - ($1 || ' days')::interval`,
      [String(RETENTION_DAYS)],
    );
  }
}
