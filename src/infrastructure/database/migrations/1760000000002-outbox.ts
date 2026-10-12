import { MigrationInterface, QueryRunner } from 'typeorm';

export class Outbox1760000000002 implements MigrationInterface {
  name = 'Outbox1760000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox" (
        "id" bigserial PRIMARY KEY,
        "event_id" uuid NOT NULL UNIQUE,
        "aggregate_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "topic" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "headers" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "published_at" timestamptz
      )`);
    // The relay only scans unpublished rows.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_outbox_unpublished" ON "outbox" ("id") WHERE "published_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox"`);
  }
}
