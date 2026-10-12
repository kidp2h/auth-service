import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IHashService } from '@application/interfaces/hash-service.interface';

@Injectable()
export class Argon2HashService implements IHashService {
  private readonly logger = new Logger(Argon2HashService.name);

  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch (error) {
      // A malformed stored hash is a data problem, not a reason to answer 500:
      // treat it as a failed login and make it visible in the logs.
      this.logger.warn(
        `Password hash could not be verified: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
