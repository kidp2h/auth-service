import { existsSync } from 'fs';

// Load .env file natively in Node v20.12.0+ / v21.7.0+ for local development
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT;
  const authGrpcUrl = process.env.AUTH_GRPC_URL;

  if (!port) {
    throw new Error('Missing required environment variable: PORT');
  }
  if (!authGrpcUrl) {
    throw new Error('Missing required environment variable: AUTH_GRPC_URL');
  }

  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, 'infrastructure/proto/auth.proto'),
      url: authGrpcUrl,
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
}
bootstrap();
