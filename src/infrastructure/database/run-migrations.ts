import { Logger } from '@nestjs/common';
import { DataSource, MigrationExecutor } from 'typeorm';

// Arbitrary constant identifying "auth-service migrations" in advisory locks.
const MIGRATION_LOCK_KEY = 727_274_001;

/**
 * Runs pending migrations in ONE transaction that first takes a
 * transaction-scoped advisory lock, so several pods starting together
 * (rolling update, HPA) cannot race: the others wait, then find nothing to do.
 *
 * pg_advisory_xact_lock is released automatically at COMMIT/ROLLBACK and is
 * safe behind a transaction-mode pooler (PgBouncer, Neon pooled endpoint),
 * unlike the session-level pg_advisory_lock which could leak onto a pooled
 * server connection. A failed migration rolls everything back, leaving the
 * schema untouched and the pod crash-looping visibly instead of half-migrated.
 */
export async function runMigrations(dataSource: DataSource): Promise<void> {
  const logger = new Logger('Migrations');
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.startTransaction();
    await queryRunner.query('SELECT pg_advisory_xact_lock($1)', [
      MIGRATION_LOCK_KEY,
    ]);
    // Our transaction is already active, so the executor joins it.
    const executed = await new MigrationExecutor(
      dataSource,
      queryRunner,
    ).executePendingMigrations();
    await queryRunner.commitTransaction();
    logger.log(
      executed.length
        ? `Applied: ${executed.map((m) => m.name).join(', ')}`
        : 'Database schema is up to date',
    );
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}
