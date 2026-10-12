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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExcludeEndpoint,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '@application/services/auth.service';
import { RegisterDto } from '@application/dtos/register.dto';
import { LoginDto } from '@application/dtos/login.dto';
import { RefreshTokenDto } from '@application/dtos/refresh-token.dto';
import { LogoutDto } from '@application/dtos/logout.dto';
import { AuthResponseDto } from '@application/dtos/auth-response.dto';
import { JwtKeyStore } from '@infrastructure/services/jwt-key-store';
import { JwtBlacklistGuard } from '@presentation/guards/jwt-blacklist.guard';
import { ApiEnvelopeResponse } from '@presentation/swagger/api-envelope.decorator';
import { ErrorResponseDto } from '@presentation/swagger/error-response.dto';
import { BEARER_AUTH } from '@presentation/swagger/setup-swagger';

const validation = new ValidationPipe({ whitelist: true, transform: true });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly keys: JwtKeyStore,
  ) {}

  // Legacy probe path, kept until every environment probes /auth/health/live
  // and /auth/health/ready (see HealthController).
  @ApiExcludeEndpoint()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Public keys for local token verification by other services. Served raw
  // (no response envelope), as JWKS clients expect.
  @ApiTags('keys')
  @ApiOperation({
    summary: 'Public signing keys (JWKS)',
    description:
      'Other services verify access tokens locally with these keys instead of calling auth. Empty while auth still signs with the deprecated shared secret.',
  })
  @ApiOkResponse({
    description: 'JSON Web Key Set (not wrapped in the response envelope).',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', example: 'RSA' },
              alg: { type: 'string', example: 'RS256' },
              use: { type: 'string', example: 'sig' },
              kid: { type: 'string' },
              n: { type: 'string' },
              e: { type: 'string', example: 'AQAB' },
            },
          },
        },
      },
    },
  })
  @Get('.well-known/jwks.json')
  jwks(@Res() res: Response) {
    res.set('Cache-Control', 'public, max-age=300').json(this.keys.jwks());
  }

  @ApiOperation({
    summary: 'Create an account',
    description:
      'Creates the account and returns tokens. The profile is created asynchronously, so it may appear in profile-service a few seconds later.',
  })
  @ApiEnvelopeResponse(AuthResponseDto, 201, 'Account created.')
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Invalid email, password shorter than 8 characters or missing name.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'ACCOUNT_ALREADY_EXISTS: the email is taken (case-insensitive).',
  })
  @ApiResponse({
    status: 503,
    type: ErrorResponseDto,
    description:
      'PROFILE_SERVICE_UNAVAILABLE: only when profile creation is synchronous (PROFILE_SYNC_MODE=grpc) and profile-service is down; the account is rolled back.',
  })
  @Post('register')
  @UsePipes(validation)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.ip(req), this.device(req));
  }

  @ApiOperation({ summary: 'Sign in' })
  @ApiEnvelopeResponse(AuthResponseDto, 201, 'Signed in.')
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'AUTH_INVALID_CREDENTIALS: wrong email or password (the same answer for both).',
  })
  @ApiResponse({
    status: 429,
    type: ErrorResponseDto,
    description:
      'AUTH_TOO_MANY_ATTEMPTS: too many failed attempts for this email or IP; locked for 15 minutes.',
  })
  @Post('login')
  @UsePipes(validation)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.ip(req), this.device(req));
  }

  @ApiOperation({
    summary: 'Get a new access token',
    description:
      'Rotates the refresh token: the one you send is consumed and a new one is returned. Sending an already used refresh token revokes the whole chain.',
  })
  @ApiEnvelopeResponse(AuthResponseDto, 200, 'New access and refresh tokens.')
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'AUTH_INVALID_REFRESH_TOKEN: unknown, expired or already used.',
  })
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

  @ApiOperation({
    summary: 'Sign out',
    description:
      'Revokes the session of the access token in the Authorization header and, if a refresh token is sent, its whole family.',
  })
  @ApiBearerAuth(BEARER_AUTH)
  @ApiNoContentResponse({ description: 'Signed out.' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Missing, invalid, expired or already revoked access token.',
  })
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
