import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from '@presentation/filters/all-exceptions.filter';
import { TransformInterceptor } from '@presentation/interceptors/transform.interceptor';
import { HttpMetricsInterceptor } from '@presentation/interceptors/http-metrics.interceptor';
import { validateEnv } from '@infrastructure/config/env.validation';
import { MIGRATIONS } from '@infrastructure/database/migrations';
import { loggerConfig } from '@infrastructure/observability/logger.config';
import { ObservabilityModule } from '@infrastructure/observability/observability.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot(loggerConfig),
    ObservabilityModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        // Managed Postgres (Supabase, Neon, RDS) requires TLS. Certificate
        // verification is off until a CA bundle is mounted.
        ssl:
          configService.get<string>('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        autoLoadEntities: true,
        // Schema changes only through versioned migrations (expand ->
        // migrate -> contract). They run in main.ts under an advisory lock.
        synchronize: false,
        migrations: MIGRATIONS,
        migrationsRun: false,
      }),
    }),
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
