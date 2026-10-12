import { MigrationInterface, QueryRunner } from 'typeorm';

// Baseline. Environments created before migrations existed already have this
// table (built by synchronize), so every statement is idempotent.
export class BaselineAccounts1760000000000 implements MigrationInterface {
  name = 'BaselineAccounts1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "user_id" uuid,
        CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id")
      )`);
  }

  async down(): Promise<void> {
    // Baseline is never reverted.
  }
}
