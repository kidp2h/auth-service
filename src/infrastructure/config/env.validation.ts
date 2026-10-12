import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  @IsNotEmpty()
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  AUTH_GRPC_URL!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsIn(['true', 'false'])
  @IsOptional()
  DATABASE_SSL?: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsNumber()
  @IsNotEmpty()
  REDIS_PORT!: number;

  // Token signing: RS256 with JWT_PRIVATE_KEY (preferred, public keys are
  // published through JWKS) or the deprecated shared JWT_SECRET (HS256).
  // At least one is required, checked in validateEnv.
  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  JWT_KEY_ID?: string;

  // Public key of the previous signing key, kept during rotation.
  @IsString()
  @IsOptional()
  JWT_PREVIOUS_PUBLIC_KEY?: string;

  @IsNumber()
  @Min(60)
  @IsOptional()
  JWT_ACCESS_TTL_SECONDS?: number;

  @IsNumber()
  @Min(60)
  @IsOptional()
  REFRESH_TOKEN_TTL_SECONDS?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  LOGIN_MAX_FAILURES_PER_EMAIL?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  LOGIN_MAX_FAILURES_PER_IP?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  LOGIN_LOCK_SECONDS?: number;

  @IsString()
  @IsNotEmpty()
  PROFILE_SERVICE_URL!: string;

  @IsNumber()
  @Min(100)
  @IsOptional()
  PROFILE_GRPC_DEADLINE_MS?: number;

  // grpc: create the profile synchronously (default, current behaviour).
  // event: publish account.created through the outbox; needs KAFKA_BROKERS
  // and profile-service consuming the topic.
  @IsIn(['grpc', 'event'])
  @IsOptional()
  PROFILE_SYNC_MODE?: string;

  @ValidateIf((env: EnvironmentVariables) => env.PROFILE_SYNC_MODE === 'event')
  @IsString()
  @IsNotEmpty()
  KAFKA_BROKERS?: string;

  @IsString()
  @IsOptional()
  KAFKA_CLIENT_ID?: string;

  @IsNumber()
  @IsOptional()
  METRICS_PORT?: number;

  // Serves the Swagger UI at /auth/docs. Set for dev only: when it is not
  // 'true' the documentation routes are not registered at all (404).
  @IsIn(['true', 'false'])
  @IsOptional()
  SWAGGER_ENABLED?: string;

  @IsString()
  @IsOptional()
  NODE_ENV?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  const details = errors.map((error) => {
    const constraints = error.constraints
      ? Object.values(error.constraints).join(', ')
      : 'Invalid value';
    return `  👉 [${error.property}]: ${constraints}`;
  });

  if (!validatedConfig.JWT_PRIVATE_KEY && !validatedConfig.JWT_SECRET) {
    details.push(
      '  👉 [JWT_PRIVATE_KEY]: set JWT_PRIVATE_KEY (or the deprecated JWT_SECRET)',
    );
  }

  if (details.length > 0) {
    throw new Error(
      `\n❌ [Config Error] Invalid or missing environment variables:\n${details.join('\n')}\nPlease check your .env file!\n`,
    );
  }

  return validatedConfig;
}
