import { MigrationInterface, QueryRunner } from 'typeorm';

// Emails are compared case-insensitively. Fails loudly if two existing rows
// differ only by case: resolve those by hand before deploying.
export class AccountEmailUniqueLower1760000000001 implements MigrationInterface {
  name = 'AccountEmailUniqueLower1760000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_accounts_email_lower" ON "accounts" (lower("email"))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_accounts_email_lower"`);
  }
}
