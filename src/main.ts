// Tracing must load before everything else.
import './tracing';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { runMigrations } from '@infrastructure/database/run-migrations';
import { setupSwagger } from '@presentation/swagger/setup-swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT: run shutdown hooks (readiness flips to 503, then connections close).
  app.enableShutdownHooks();

  // Before any listener or relay starts: the schema must be current.
  await runMigrations(app.get(DataSource));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT')!;
  const authGrpcUrl = configService.get<string>('AUTH_GRPC_URL')!;

  // API documentation exists only where it is switched on (dev): everywhere
  // else /auth/docs is a plain 404 because the routes are never registered.
  if (configService.get<string>('SWAGGER_ENABLED') === 'true') {
    setupSwagger(app);
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth.v1',
      protoPath: join(__dirname, 'infrastructure/proto/auth/auth.proto'),
      url: authGrpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Auth Service (REST) is running on port ${port}`, 'Bootstrap');
  logger.log(`Auth Service (gRPC) is running on ${authGrpcUrl}`, 'Bootstrap');
}
void bootstrap();
