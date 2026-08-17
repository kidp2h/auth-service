import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import {
  ACCOUNT_PORT,
  SESSION_PORT,
  HASH_SERVICE,
  TOKEN_SERVICE,
  USER_PROFILE_PORT,
} from './auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
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
            url:
              configService.get<string>('PROFILE_SERVICE_URL') ||
              'profile-service:50051',
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, AuthGrpcController],
  providers: [
    AuthService,
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
