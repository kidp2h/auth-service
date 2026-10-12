import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '@application/services/auth.service';
import { RegisterDto } from '@application/dtos/register.dto';
import { LoginDto } from '@application/dtos/login.dto';
import { RefreshTokenDto } from '@application/dtos/refresh-token.dto';
import { LogoutDto } from '@application/dtos/logout.dto';
import { JwtKeyStore } from '@infrastructure/services/jwt-key-store';
import { JwtBlacklistGuard } from '@presentation/guards/jwt-blacklist.guard';

const validation = new ValidationPipe({ whitelist: true, transform: true });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly keys: JwtKeyStore,
  ) {}

  // Legacy probe path, kept until every environment probes /auth/health/live
  // and /auth/health/ready (see HealthController).
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Public keys for local token verification by other services. Served raw
  // (no response envelope), as JWKS clients expect.
  @Get('.well-known/jwks.json')
  jwks(@Res() res: Response) {
    res.set('Cache-Control', 'public, max-age=300').json(this.keys.jwks());
  }

  @Post('register')
  @UsePipes(validation)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.ip(req), this.device(req));
  }

  @Post('login')
  @UsePipes(validation)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.ip(req), this.device(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @UsePipes(validation)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      this.ip(req),
      this.device(req),
    );
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtBlacklistGuard)
  @UsePipes(validation)
  async logout(@Body() dto: LogoutDto, @Req() req: Request) {
    const user = (req as any).user as { jti: string; userId: string };
    await this.authService.logout(user.jti, user.userId, dto.refreshToken);
  }

  private ip(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private device(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }
}
