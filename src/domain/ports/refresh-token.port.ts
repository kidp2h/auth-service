import { RefreshToken } from '@domain/entities/refresh-token.entity';

export interface IRefreshTokenPort {
  save(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Atomically retires `oldId` and stores its successor. */
  rotate(oldId: string, next: RefreshToken): Promise<boolean>;
  revokeFamily(familyId: string): Promise<void>;
}
