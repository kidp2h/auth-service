import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT')!;
  const authGrpcUrl = configService.get<string>('AUTH_GRPC_URL')!;

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

  logger.log(`🚀 Auth Service (REST) is running on: http://localhost:${port}`);
  logger.log(`🔌 Auth Service (gRPC) is running on: ${authGrpcUrl}`);
}
bootstrap();
