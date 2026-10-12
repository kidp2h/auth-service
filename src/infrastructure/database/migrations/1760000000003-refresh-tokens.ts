import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokens1760000000003 implements MigrationInterface {
  name = 'RefreshTokens1760000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY,
        "account_id" uuid NOT NULL,
        "family_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL UNIQUE,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires" ON "refresh_tokens" ("expires_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
