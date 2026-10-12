import { Column, Entity, PrimaryColumn } from 'typeorm';

// Persistence model of the `accounts` table (schema owned by migrations).
// The legacy `user_id` column is intentionally not mapped: profile-service owns
// profile ids and auth only references accounts by accountId.
@Entity('accounts')
export class AccountOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column({ name: 'passwordHash' })
  passwordHash!: string;
}
