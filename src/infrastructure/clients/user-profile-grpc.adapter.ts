import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientGrpc } from '@nestjs/microservices';
import { Metadata, status } from '@grpc/grpc-js';
import {
  BrokenCircuitError,
  ConsecutiveBreaker,
  ExponentialBackoff,
  circuitBreaker,
  handleWhen,
  retry,
  wrap,
} from 'cockatiel';
import { firstValueFrom, Observable } from 'rxjs';
import { IUserProfilePort } from '@domain/ports/user-profile.port';
import { ProfileServiceUnavailableException } from '@domain/exceptions/profile-service-unavailable.exception';

interface UserProfileGrpcServiceClient {
  createProfile(
    data: { accountId: string; email: string; name: string },
    metadata: Metadata,
    options: { deadline: number },
  ): Observable<unknown>;
}

// Transient infrastructure failures only. Business errors (INVALID_ARGUMENT,
// ALREADY_EXISTS...) must neither be retried nor trip the breaker.
const TRANSIENT = new Set<number>([
  status.UNAVAILABLE,
  status.DEADLINE_EXCEEDED,
  status.RESOURCE_EXHAUSTED,
]);
const isTransient = (error: unknown): boolean =>
  TRANSIENT.has((error as { code?: number })?.code ?? -1);

/**
 * Outbound call to profile-service, wrapped in the standard resilience stack:
 * per-attempt deadline, bounded retries with exponential backoff + jitter, and
 * a circuit breaker that fails fast while profile is down. Retrying
 * CreateProfile is safe because profile-service is idempotent on accountId.
 */
@Injectable()
export class UserProfileGrpcAdapter implements IUserProfilePort, OnModuleInit {
  private readonly logger = new Logger(UserProfileGrpcAdapter.name);
  private client!: UserProfileGrpcServiceClient;
  private deadlineMs!: number;

  private readonly breaker = circuitBreaker(handleWhen(isTransient), {
    halfOpenAfter: 30_000,
    breaker: new ConsecutiveBreaker(5),
  });
  // Retry wraps the breaker: each attempt counts towards the breaker, and an
  // open circuit (BrokenCircuitError) is not retried.
  private readonly policy = wrap(
    retry(handleWhen(isTransient), {
      maxAttempts: 2,
      backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 2000 }),
    }),
    this.breaker,
  );

  constructor(
    @Inject('USER_PACKAGE') private readonly grpc: ClientGrpc,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.client =
      this.grpc.getService<UserProfileGrpcServiceClient>('ProfileService');
    this.deadlineMs = Number(
      this.config.get('PROFILE_GRPC_DEADLINE_MS') ?? 2000,
    );
    this.breaker.onStateChange((state) =>
      this.logger.warn(`profile-service circuit breaker is now ${state}`),
    );
  }

  async createProfile(
    accountId: string,
    email: string,
    name: string,
  ): Promise<void> {
    try {
      await this.policy.execute(() =>
        firstValueFrom(
          this.client.createProfile(
            { accountId, email, name },
            new Metadata(),
            { deadline: Date.now() + this.deadlineMs },
          ),
        ),
      );
    } catch (error) {
      if (error instanceof BrokenCircuitError || isTransient(error)) {
        throw new ProfileServiceUnavailableException();
      }
      throw error;
    }
  }
}
