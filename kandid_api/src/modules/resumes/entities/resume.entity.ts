import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/**
 * Currículo nomeado do usuário autenticado (ADR 0005 `:37-55`).
 *
 * `name` é único por usuário (`UQ_resumes_user_name`); `target_role` é
 * `NOT NULL` e recebe `desired_role` do perfil ou `''` quando omitido no POST.
 * A unicidade do default (`is_default`) é garantida em transação pelo service,
 * não por índice — o banco não oferece índice parcial simples no MySQL.
 */
@Entity({ name: 'resumes' })
@Unique('UQ_resumes_user_name', ['userId', 'name'])
@Index('IX_resumes_user_created', ['userId', 'createdAt', 'id'])
export class Resume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_resumes_user',
  })
  user: User;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'target_role', type: 'varchar', length: 160 })
  targetRole: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
