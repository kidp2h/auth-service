import { DomainException } from './domain.exception';

export class ProfileServiceUnavailableException extends DomainException {
  readonly errorCode = 'PROFILE_SERVICE_UNAVAILABLE';
  readonly statusCode = 503;

  constructor() {
    super('Profile service is unavailable. Please retry shortly.');
    this.name = 'ProfileServiceUnavailableException';
  }
}
