import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '@domain/entities/account.entity';
import { IAccountPort } from '@domain/ports/account.port';
import { randomUUID } from 'crypto';

@Injectable()
export class TypeOrmAccountAdapter implements IAccountPort {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async findByEmail(email: string): Promise<Account | null> {
    return this.accountRepository.findOne({ where: { email } });
  }

  async createAccount(email: string, passwordHash: string, userId?: string | null): Promise<Account> {
    const id = randomUUID();
    const account = new Account(id, email, passwordHash, userId);
    return this.accountRepository.save(account);
  }

  async updateAccount(account: Account): Promise<Account> {
    return this.accountRepository.save(account);
  }
}
