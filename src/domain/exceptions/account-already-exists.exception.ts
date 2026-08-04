import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class AccountAlreadyExistsException extends DomainException {
  readonly errorCode = 'ACCOUNT_ALREADY_EXISTS';
  readonly statusCode = HttpStatus.CONFLICT;

  constructor(email: string) {
    super(`Account with email ${email} already exists`);
    this.name = 'AccountAlreadyExistsException';
  }
}
