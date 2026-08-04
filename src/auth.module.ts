import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { join } from 'path';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthGrpcController } from './presentation/controllers/auth-grpc.controller';
import { AuthService } from './application/services/auth.service';
import { TypeOrmAccountAdapter } from '@infrastructure/database/typeorm-account.adapter';
import { UserProfileGrpcAdapter } from '@infrastructure/clients/user-profile-grpc.adapter';
import { RedisSessionAdapter } from '@infrastructure/clients/redis-session.adapter';
import { Argon2HashService } from '@infrastructure/services/argon2-hash.service';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { Account } from '@domain/entities/account.entity';
import { ACCOUNT_PORT, SESSION_PORT, HASH_SERVICE, TOKEN_SERVICE, USER_PROFILE_PORT } from './auth.constants';

const jwtSecret = process.env.JWT_SECRET;
const userServiceUrl = process.env.USER_SERVICE_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const databaseUrl = process.env.DATABASE_URL;

if (!jwtSecret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

if (!userServiceUrl) {
  throw new Error('Missing required environment variable: USER_SERVICE_URL');
}

if (!redisHost) {
  throw new Error('Missing required environment variable: REDIS_HOST');
}

if (!redisPort) {
  throw new Error('Missing required environment variable: REDIS_PORT');
}

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      synchronize: true, // Only for development/demo
    }),
    TypeOrmModule.forFeature([Account]),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '1h' },
    }),
    ClientsModule.register([
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'infrastructure/proto/user.proto'),
          url: userServiceUrl,
        },
      },
    ]),
  ],
  controllers: [AuthController, AuthGrpcController],
  providers: [
    AuthService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: redisHost,
          port: parseInt(redisPort, 10),
        });
      },
    },
    {
      provide: ACCOUNT_PORT,
      useClass: TypeOrmAccountAdapter,
    },
    {
      provide: USER_PROFILE_PORT,
      useClass: UserProfileGrpcAdapter,
    },
    {
      provide: SESSION_PORT,
      useClass: RedisSessionAdapter,
    },
    {
      provide: HASH_SERVICE,
      useClass: Argon2HashService,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenService,
    },
  ],
})
export class AuthModule {}
