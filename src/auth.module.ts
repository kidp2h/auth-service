import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { join } from 'path';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthGrpcController } from './presentation/controllers/auth-grpc.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { AuthService } from './application/services/auth.service';
import { ReadinessService } from '@infrastructure/health/readiness.service';
import { TypeOrmAccountAdapter } from '@infrastructure/database/typeorm-account.adapter';
import { TypeOrmRefreshTokenAdapter } from '@infrastructure/database/typeorm-refresh-token.adapter';
import { AccountOrmEntity } from '@infrastructure/database/entities/account.orm-entity';
import { RefreshTokenOrmEntity } from '@infrastructure/database/entities/refresh-token.orm-entity';
import { OutboxOrmEntity } from '@infrastructure/database/entities/outbox.orm-entity';
import { UserProfileGrpcAdapter } from '@infrastructure/clients/user-profile-grpc.adapter';
import { RedisSessionAdapter } from '@infrastructure/clients/redis-session.adapter';
import { RedisLoginAttemptAdapter } from '@infrastructure/clients/redis-login-attempt.adapter';
import { OutboxRelayService } from '@infrastructure/messaging/outbox-relay.service';
import { Argon2HashService } from '@infrastructure/services/argon2-hash.service';
import { JwtKeyStore } from '@infrastructure/services/jwt-key-store';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import {
  ACCOUNT_PORT,
  AUTH_CONFIG,
  AuthConfig,
  LOGIN_ATTEMPT_PORT,
  REFRESH_TOKEN_PORT,
  SESSION_PORT,
  HASH_SERVICE,
  TOKEN_SERVICE,
  USER_PROFILE_PORT,
} from './auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountOrmEntity,
      RefreshTokenOrmEntity,
      OutboxOrmEntity,
    ]),
    // Keys and algorithms are passed per call by JwtTokenService (JwtKeyStore).
    JwtModule.register({}),
    ClientsModule.registerAsync([
      {
        name: 'USER_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'user',
            protoPath: join(__dirname, 'infrastructure/proto/user.proto'),
            url: configService.get<string>('PROFILE_SERVICE_URL')!,
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, AuthGrpcController, HealthController],
  providers: [
    AuthService,
    ReadinessService,
    JwtKeyStore,
    OutboxRelayService,
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AuthConfig => ({
        accessTtlSeconds: config.get<number>('JWT_ACCESS_TTL_SECONDS') ?? 900,
        refreshTtlSeconds:
          config.get<number>('REFRESH_TOKEN_TTL_SECONDS') ?? 7 * 24 * 3600,
        profileSyncMode:
          config.get<string>('PROFILE_SYNC_MODE') === 'event'
            ? 'event'
            : 'grpc',
        maxFailuresPerEmail:
          config.get<number>('LOGIN_MAX_FAILURES_PER_EMAIL') ?? 5,
        maxFailuresPerIp: config.get<number>('LOGIN_MAX_FAILURES_PER_IP') ?? 50,
        lockSeconds: config.get<number>('LOGIN_LOCK_SECONDS') ?? 900,
      }),
    },
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST')!,
          port: configService.get<number>('REDIS_PORT')!,
        });
      },
    },
    {
      provide: ACCOUNT_PORT,
      useClass: TypeOrmAccountAdapter,
    },
    {
      provide: REFRESH_TOKEN_PORT,
      useClass: TypeOrmRefreshTokenAdapter,
    },
    {
      provide: LOGIN_ATTEMPT_PORT,
      useClass: RedisLoginAttemptAdapter,
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
  exports: [AuthService, ACCOUNT_PORT, SESSION_PORT],
})
export class AuthModule {}
