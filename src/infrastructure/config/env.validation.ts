import { plainToInstance } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
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

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @IsNumber()
  @IsNotEmpty()
  REDIS_PORT!: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  PROFILE_SERVICE_URL?: string;

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

  if (errors.length > 0) {
    const errorDetails = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Invalid value';
        return `  👉 [${error.property}]: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `\n❌ [Config Error] Invalid or missing environment variables:\n${errorDetails}\nPlease check your .env file!\n`,
    );
  }

  return validatedConfig;
}
