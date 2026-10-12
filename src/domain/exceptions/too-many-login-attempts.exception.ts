import { DomainException } from './domain.exception';

export class TooManyLoginAttemptsException extends DomainException {
  readonly errorCode = 'AUTH_TOO_MANY_ATTEMPTS';
  readonly statusCode = 429;

  constructor(readonly retryAfterSeconds: number) {
    super(`Too many failed attempts. Try again in ${retryAfterSeconds}s.`);
    this.name = 'TooManyLoginAttemptsException';
  }
}
