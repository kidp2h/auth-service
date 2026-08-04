import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('accounts')
export class Account {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  constructor(id: string, email: string, passwordHash: string, userId?: string | null) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
    this.userId = userId;
  }
}
