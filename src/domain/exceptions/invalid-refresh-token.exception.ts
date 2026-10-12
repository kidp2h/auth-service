import { DomainException } from './domain.exception';

export class InvalidRefreshTokenException extends DomainException {
  readonly errorCode = 'AUTH_INVALID_REFRESH_TOKEN';
  readonly statusCode = 401;

  constructor() {
    super('Refresh token is invalid, expired or already used.');
    this.name = 'InvalidRefreshTokenException';
  }
}
