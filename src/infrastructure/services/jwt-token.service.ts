import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ITokenService,
  TokenPayload,
} from '@application/interfaces/token-service.interface';
import { AUTH_CONFIG } from '@/auth.constants';
import type { AuthConfig } from '@/auth.constants';
import { JwtKeyStore } from './jwt-key-store';

@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly keys: JwtKeyStore,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async generateToken(payload: TokenPayload): Promise<string> {
    const expiresIn = this.config.accessTtlSeconds;
    if (this.keys.mode === 'rs256') {
      return this.jwtService.signAsync(payload, {
        privateKey: this.keys.signingKey,
        algorithm: 'RS256',
        keyid: this.keys.signingKid,
        expiresIn,
      });
    }
    return this.jwtService.signAsync(payload, {
      secret: this.keys.signingKey,
      algorithm: 'HS256',
      expiresIn,
    });
  }

  async verifyToken(token: string): Promise<any> {
    const decoded = this.jwtService.decode(token, { complete: true });
    const key = this.keys.publicKeyFor(decoded?.header?.kid);
    if (!key) {
      throw new Error('Unknown signing key');
    }
    return this.keys.mode === 'rs256'
      ? this.jwtService.verifyAsync(token, {
          publicKey: key,
          algorithms: ['RS256'],
        })
      : this.jwtService.verifyAsync(token, {
          secret: key,
          algorithms: ['HS256'],
        });
  }
}
