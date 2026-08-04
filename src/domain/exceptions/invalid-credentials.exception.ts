import { DomainException } from './domain.exception';

export class InvalidCredentialsException extends DomainException {
  readonly errorCode = 'AUTH_INVALID_CREDENTIALS';
  readonly statusCode = 401;

  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsException';
  }
}
