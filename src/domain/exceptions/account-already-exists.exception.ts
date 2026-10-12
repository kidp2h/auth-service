import { DomainException } from './domain.exception';

export class AccountAlreadyExistsException extends DomainException {
  readonly errorCode = 'ACCOUNT_ALREADY_EXISTS';
  readonly statusCode = 409;

  constructor(email: string) {
    super(`Account with email ${email} already exists`);
    this.name = 'AccountAlreadyExistsException';
  }
}
