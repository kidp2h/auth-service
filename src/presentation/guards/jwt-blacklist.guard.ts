import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import type { ISessionPort } from '@domain/ports/session.port';
import type { ITokenService } from '@application/interfaces/token-service.interface';
import { SESSION_PORT, TOKEN_SERVICE } from '@/auth.constants';

/**
 * Verifies the bearer token and checks that its session was not revoked.
 * Only used for auth's own endpoints (logout): other services verify tokens
 * locally against the JWKS and do not call auth per request.
 */
@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(SESSION_PORT) private readonly sessionPort: ISessionPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    let payload: { jti?: string };
    try {
      payload = await this.tokenService.verifyToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload?.jti) {
      throw new UnauthorizedException('Invalid token structure');
    }
    if (await this.sessionPort.isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Available to the handler.
    (request as any).user = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
