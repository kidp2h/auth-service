import { randomUUID } from 'crypto';
import { trace } from '@opentelemetry/api';
import { Params } from 'nestjs-pino';

/**
 * Structured JSON logs. Every line carries the service name, and request logs
 * carry the request id (accepted from the caller or generated) plus the
 * trace/span id of the active OpenTelemetry span, so logs, traces and the
 * gateway's request id can be joined. Secrets are redacted; bodies are never
 * logged.
 */
export const loggerConfig: Params = {
  pinoHttp: {
    base: { service: process.env.OTEL_SERVICE_NAME ?? 'auth-service' },
    level: process.env.LOG_LEVEL ?? 'info',
    // Level as text ("info") instead of pino's numeric level.
    formatters: { level: (label) => ({ level: label }) },
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && incoming ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    mixin: () => {
      const ctx = trace.getActiveSpan()?.spanContext();
      return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      censor: '[redacted]',
    },
    // Health probes and metrics scrapes would otherwise dominate the logs.
    autoLogging: {
      ignore: (req) => (req.url ?? '').startsWith('/auth/health'),
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
};
