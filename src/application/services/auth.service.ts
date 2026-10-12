import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { RegisterDto } from '@application/dtos/register.dto';
import { LoginDto } from '@application/dtos/login.dto';
import { AuthResponseDto } from '@application/dtos/auth-response.dto';
import { normalizeEmail } from '@application/dtos/email.transform';
import { Account } from '@domain/entities/account.entity';
import { AccountSession } from '@domain/entities/account-session.entity';
import { RefreshToken } from '@domain/entities/refresh-token.entity';
import { accountCreated } from '@domain/events/account-created.event';
import type { IAccountPort } from '@domain/ports/account.port';
import type { ISessionPort } from '@domain/ports/session.port';
import type { IUserProfilePort } from '@domain/ports/user-profile.port';
import type { IRefreshTokenPort } from '@domain/ports/refresh-token.port';
import type { ILoginAttemptPort } from '@domain/ports/login-attempt.port';
import type { IHashService } from '@application/interfaces/hash-service.interface';
import type { ITokenService } from '@application/interfaces/token-service.interface';
import { AccountAlreadyExistsException } from '@domain/exceptions/account-already-exists.exception';
import { InvalidCredentialsException } from '@domain/exceptions/invalid-credentials.exception';
import { InvalidRefreshTokenException } from '@domain/exceptions/invalid-refresh-token.exception';
import { TooManyLoginAttemptsException } from '@domain/exceptions/too-many-login-attempts.exception';
import { ProfileServiceUnavailableException } from '@domain/exceptions/profile-service-unavailable.exception';
import {
  ACCOUNT_PORT,
  AUTH_CONFIG,
  HASH_SERVICE,
  LOGIN_ATTEMPT_PORT,
  REFRESH_TOKEN_PORT,
  SESSION_PORT,
  TOKEN_SERVICE,
  USER_PROFILE_PORT,
} from '@/auth.constants';
import type { AuthConfig } from '@/auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(SESSION_PORT) private readonly sessionPort: ISessionPort,
    @Inject(USER_PROFILE_PORT) private readonly profilePort: IUserProfilePort,
    @Inject(REFRESH_TOKEN_PORT)
    private readonly refreshTokenPort: IRefreshTokenPort,
    @Inject(LOGIN_ATTEMPT_PORT)
    private readonly loginAttempts: ILoginAttemptPort,
    @Inject(HASH_SERVICE) private readonly hashService: IHashService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async register(
    dto: RegisterDto,
    ipAddress: string,
    device: string,
  ): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email) as string;

    // Fast path only. The unique index on lower(email) is what really
    // guarantees uniqueness; the adapter maps its violation to the same error.
    if (await this.accountPort.findByEmail(email)) {
      throw new AccountAlreadyExistsException(email);
    }

    const account = new Account(
      randomUUID(),
      email,
      await this.hashService.hash(dto.password),
    );

    if (this.config.profileSyncMode === 'event') {
      // Account and event are written in one transaction (outbox); profile
      // creation happens asynchronously in profile-service.
      await this.accountPort.createAccount(account, [
        accountCreated({ accountId: account.id, email, name: dto.name }),
      ]);
    } else {
      await this.accountPort.createAccount(account, []);
      await this.createProfileOrCompensate(account, dto.name);
    }

    return this.issueTokens(account, ipAddress, device, dto.name);
  }

  async login(
    dto: LoginDto,
    ipAddress: string,
    device: string,
  ): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email) as string;

    const retryAfter = await this.loginAttempts.lockedFor(email, ipAddress);
    if (retryAfter > 0) {
      throw new TooManyLoginAttemptsException(retryAfter);
    }

    const account = await this.accountPort.findByEmail(email);
    // Always run one argon2 verification, so an unknown email cannot be told
    // apart from a wrong password by response time.
    const hash = account?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await this.hashService.compare(dto.password, hash);

    if (!account || !passwordOk) {
      await this.loginAttempts.recordFailure(email, ipAddress);
      throw new InvalidCredentialsException();
    }

    await this.loginAttempts.reset(email);
    return this.issueTokens(account, ipAddress, device, '');
  }

  async refresh(
    refreshToken: string,
    ipAddress: string,
    device: string,
  ): Promise<AuthResponseDto> {
    const stored = await this.refreshTokenPort.findByHash(
      this.hashRefreshToken(refreshToken),
    );
    if (!stored) {
      throw new InvalidRefreshTokenException();
    }

    // A token that was already rotated or revoked is being replayed: assume
    // theft and kill the whole family, so the legitimate client must log in again.
    if (stored.revokedAt || stored.replacedBy) {
      await this.refreshTokenPort.revokeFamily(stored.familyId);
      this.logger.warn(
        `Refresh token reuse detected, family ${stored.familyId} revoked`,
      );
      throw new InvalidRefreshTokenException();
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    const next = this.newRefreshToken(stored.accountId, stored.familyId);
    const rotated = await this.refreshTokenPort.rotate(stored.id, next.entity);
    if (!rotated) {
      // Lost a race with a concurrent refresh using the same token.
      await this.refreshTokenPort.revokeFamily(stored.familyId);
      throw new InvalidRefreshTokenException();
    }

    // The access token needs the email, which is not on the refresh token.
    const account = await this.accountPort.findById(stored.accountId);
    if (!account) {
      throw new InvalidRefreshTokenException();
    }
    return this.buildResponse(account, ipAddress, device, '', next.plain);
  }

  async logout(
    jti: string,
    accountId: string,
    refreshToken?: string,
  ): Promise<void> {
    await this.sessionPort.revokeSession(jti);
    if (refreshToken) {
      const stored = await this.refreshTokenPort.findByHash(
        this.hashRefreshToken(refreshToken),
      );
      if (stored && stored.accountId === accountId) {
        await this.refreshTokenPort.revokeFamily(stored.familyId);
      }
    }
  }

  async verifyToken(
    token: string,
  ): Promise<{ isValid: boolean; userId: string; email: string }> {
    try {
      const payload = await this.tokenService.verifyToken(token);
      if (!payload || !payload.jti) {
        return { isValid: false, userId: '', email: '' };
      }

      const isBlacklisted = await this.sessionPort.isTokenBlacklisted(
        payload.jti,
      );
      if (isBlacklisted) {
        return { isValid: false, userId: '', email: '' };
      }

      return {
        isValid: true,
        userId: payload.userId || '',
        email: payload.email || '',
      };
    } catch {
      return { isValid: false, userId: '', email: '' };
    }
  }

  // Saga step with an explicit compensation: the account must not outlive a
  // failed profile creation (createProfile is idempotent, so retries inside
  // the adapter are safe).
  private async createProfileOrCompensate(
    account: Account,
    name: string,
  ): Promise<void> {
    try {
      await this.profilePort.createProfile(account.id, account.email, name);
    } catch (error) {
      this.logger.error(
        `Profile creation failed for account ${account.id}, rolling back`,
        error instanceof Error ? error.stack : String(error),
      );
      try {
        await this.accountPort.deleteById(account.id);
      } catch (compensationError) {
        this.logger.error(
          `Compensation failed, orphan account ${account.id} needs cleanup`,
          compensationError instanceof Error
            ? compensationError.stack
            : String(compensationError),
        );
      }
      throw new ProfileServiceUnavailableException();
    }
  }

  private async issueTokens(
    account: Account,
    ipAddress: string,
    device: string,
    name: string,
  ): Promise<AuthResponseDto> {
    const refresh = this.newRefreshToken(account.id, randomUUID());
    await this.refreshTokenPort.save(refresh.entity);
    return this.buildResponse(account, ipAddress, device, name, refresh.plain);
  }

  private async buildResponse(
    account: Account,
    ipAddress: string,
    device: string,
    name: string,
    refreshToken: string,
  ): Promise<AuthResponseDto> {
    const jti = randomUUID();
    const accessToken = await this.tokenService.generateToken({
      sub: account.id,
      userId: account.id,
      email: account.email,
      jti,
    });

    await this.sessionPort.saveSession(
      new AccountSession(
        jti,
        account.id,
        ipAddress,
        device,
        false,
        Date.now() + this.config.accessTtlSeconds * 1000,
      ),
    );

    return new AuthResponseDto(
      accessToken,
      refreshToken,
      this.config.accessTtlSeconds,
      { id: account.id, email: account.email, name },
    );
  }

  private newRefreshToken(
    accountId: string,
    familyId: string,
  ): { plain: string; entity: RefreshToken } {
    const plain = randomBytes(32).toString('base64url');
    const entity = new RefreshToken(
      randomUUID(),
      accountId,
      familyId,
      this.hashRefreshToken(plain),
      new Date(Date.now() + this.config.refreshTtlSeconds * 1000),
      null,
      null,
    );
    return { plain, entity };
  }

  // Refresh tokens are high-entropy random strings, so a fast hash is enough
  // (no need for argon2); only the hash is stored.
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hashService.hash(randomUUID());
    return this.dummyHash;
  }
}
