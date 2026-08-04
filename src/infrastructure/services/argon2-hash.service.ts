import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { IHashService } from '@application/interfaces/hash-service.interface';

@Injectable()
export class Argon2HashService implements IHashService {
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
