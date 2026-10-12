// Must be the first import of main.ts: instrumentations patch modules when
// they are loaded. Tracing is off unless an OTLP endpoint is configured, so
// local runs and unconfigured environments are unaffected.
//
// Configure with the standard variables: OTEL_EXPORTER_OTLP_ENDPOINT,
// OTEL_SERVICE_NAME, OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'auth-service',
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new IORedisInstrumentation(),
      new GrpcInstrumentation(),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
}
