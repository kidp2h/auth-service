import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import type { ISessionPort } from '@domain/ports/session.port';
import { SESSION_PORT } from '@/auth.constants';

@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(SESSION_PORT) private readonly sessionPort: ISessionPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload.jti) {
        throw new UnauthorizedException('Invalid token structure');
      }

      const isBlacklisted = await this.sessionPort.isTokenBlacklisted(
        payload.jti,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      // Store payload in request for downstream route usage
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized access');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
