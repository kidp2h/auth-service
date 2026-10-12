import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'http';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Prometheus metrics. They are served on a separate internal port
 * (METRICS_PORT, default 9100) and never through the public Ingress, which
 * routes /auth only to the application port.
 */
@Injectable()
export class MetricsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MetricsService.name);
  private server?: Server;
  readonly registry = new Registry();

  // RED for HTTP: rate and errors come from the counter, duration from the histogram.
  readonly httpDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP server request duration',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });
  readonly httpRequests = new Counter({
    name: 'http_server_requests_total',
    help: 'HTTP server requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  // Outbox health: pending grows and the oldest age rises when Kafka or the
  // relay has a problem. This is the alerting signal for async delivery.
  readonly outboxPending = new Gauge({
    name: 'auth_outbox_pending_events',
    help: 'Outbox rows not yet published to Kafka',
    registers: [this.registry],
  });
  readonly outboxOldestAgeSeconds = new Gauge({
    name: 'auth_outbox_oldest_pending_age_seconds',
    help: 'Age of the oldest unpublished outbox row',
    registers: [this.registry],
  });

  constructor(private readonly config: ConfigService) {
    collectDefaultMetrics({ register: this.registry });
  }

  onApplicationBootstrap(): void {
    const port = Number(this.config.get('METRICS_PORT') ?? 9100);
    this.server = createServer((req, res) => {
      if (req.url !== '/metrics') {
        res.writeHead(404).end();
        return;
      }
      this.registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { 'Content-Type': this.registry.contentType });
          res.end(body);
        })
        .catch(() => res.writeHead(500).end());
    });
    this.server.listen(port, () =>
      this.logger.log(`Metrics served on :${port}/metrics`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
  }
}
