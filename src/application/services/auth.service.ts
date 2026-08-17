import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RegisterDto } from '@application/dtos/register.dto';
import { LoginDto } from '@application/dtos/login.dto';
import { AuthResponseDto } from '@application/dtos/auth-response.dto';
import { AccountSession } from '@domain/entities/account-session.entity';
import type { IAccountPort } from '@domain/ports/account.port';
import type { ISessionPort } from '@domain/ports/session.port';
import type { IUserProfilePort } from '@domain/ports/user-profile.port';
import type { IHashService } from '@application/interfaces/hash-service.interface';
import type { ITokenService } from '@application/interfaces/token-service.interface';
import { AccountAlreadyExistsException } from '@domain/exceptions/account-already-exists.exception';
import { InvalidCredentialsException } from '@domain/exceptions/invalid-credentials.exception';
import {
  ACCOUNT_PORT,
  SESSION_PORT,
  HASH_SERVICE,
  TOKEN_SERVICE,
  USER_PROFILE_PORT,
} from '@/auth.constants';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(SESSION_PORT) private readonly sessionPort: ISessionPort,
    @Inject(USER_PROFILE_PORT) private readonly profilePort: IUserProfilePort,
    @Inject(HASH_SERVICE) private readonly hashService: IHashService,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
  ) {}

  async register(
    dto: RegisterDto,
    ipAddress: string,
    device: string,
  ): Promise<AuthResponseDto> {
    const existingAccount = await this.accountPort.findByEmail(dto.email);
    if (existingAccount) {
      throw new AccountAlreadyExistsException(dto.email);
    }

    const hashedPassword = await this.hashService.hash(dto.password);
    const savedAccount = await this.accountPort.createAccount(
      dto.email,
      hashedPassword,
      null,
    );

    const profile = await this.profilePort.createProfile(
      savedAccount.id,
      dto.email,
      dto.name,
    );
    savedAccount.userId = profile.id;
    await this.accountPort.updateAccount(savedAccount);

    const jti = randomUUID();
    const token = await this.tokenService.generateToken({
      userId: savedAccount.id,
      email: savedAccount.email,
      jti: jti,
    });

    const session = new AccountSession(
      jti,
      savedAccount.id,
      ipAddress,
      device,
      false,
      Date.now() + 3600000, // 1 hour expiry
    );
    await this.sessionPort.saveSession(session);

    return new AuthResponseDto(token, {
      id: savedAccount.id,
      email: savedAccount.email,
      name: profile.name,
    });
  }

  async login(
    dto: LoginDto,
    ipAddress: string,
    device: string,
  ): Promise<AuthResponseDto> {
    const account = await this.accountPort.findByEmail(dto.email);
    if (!account) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await this.hashService.compare(
      dto.password,
      account.passwordHash,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    const jti = randomUUID();
    const token = await this.tokenService.generateToken({
      userId: account.id,
      email: account.email,
      jti: jti,
    });

    const session = new AccountSession(
      jti,
      account.id,
      ipAddress,
      device,
      false,
      Date.now() + 3600000, // 1 hour expiry
    );
    await this.sessionPort.saveSession(session);

    return new AuthResponseDto(token, {
      id: account.id,
      email: account.email,
      name: '',
    });
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
}
