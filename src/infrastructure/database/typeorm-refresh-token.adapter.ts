import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { RefreshToken } from '@domain/entities/refresh-token.entity';
import { IRefreshTokenPort } from '@domain/ports/refresh-token.port';
import { RefreshTokenOrmEntity } from './entities/refresh-token.orm-entity';

@Injectable()
export class TypeOrmRefreshTokenAdapter implements IRefreshTokenPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(RefreshTokenOrmEntity);
  }

  async save(token: RefreshToken): Promise<void> {
    await this.repo.insert(this.toRow(token));
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.repo.findOne({ where: { tokenHash } });
    return row
      ? new RefreshToken(
          row.id,
          row.accountId,
          row.familyId,
          row.tokenHash,
          row.expiresAt,
          row.revokedAt,
          row.replacedBy,
        )
      : null;
  }

  // The conditional update is the compare-and-swap that makes concurrent use
  // of the same refresh token succeed at most once.
  async rotate(oldId: string, next: RefreshToken): Promise<boolean> {
    return this.dataSource.transaction(async (em) => {
      const result = await em.update(
        RefreshTokenOrmEntity,
        { id: oldId, revokedAt: IsNull(), replacedBy: IsNull() },
        { revokedAt: new Date(), replacedBy: next.id },
      );
      if (!result.affected) {
        return false;
      }
      await em.insert(RefreshTokenOrmEntity, this.toRow(next));
      return true;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private toRow(token: RefreshToken): RefreshTokenOrmEntity {
    return Object.assign(new RefreshTokenOrmEntity(), {
      id: token.id,
      accountId: token.accountId,
      familyId: token.familyId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      replacedBy: token.replacedBy,
    });
  }
}
