import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Perfil profissional do candidato (1:1 com `users`).
 *
 * Regras de negócio (implementar no `ProfilesService`):
 * - `user_id` é único: cada usuário tem no máximo um perfil.
 * - `user_id` NUNCA vem do body; é sempre o `userId` do JWT.
 * - Dinheiro em centavos (`bigint`) + `currency` (ISO 4217, default BRL).
 * - `available_from` é uma data (`YYYY-MM-DD`), não um datetime.
 */
@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'headline',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  headline: string | null;

  @Column({ name: 'summary', type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'city', type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ name: 'state', type: 'varchar', length: 80, nullable: true })
  state: string | null;

  @Column({ name: 'country', type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({
    name: 'linkedin_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  linkedinUrl: string | null;

  @Column({
    name: 'github_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  githubUrl: string | null;

  @Column({
    name: 'portfolio_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  portfolioUrl: string | null;

  @Column({
    name: 'desired_role',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  desiredRole: string | null;

  @Column({
    name: 'desired_seniority',
    type: 'enum',
    enum: Seniority,
    nullable: true,
  })
  desiredSeniority: Seniority | null;

  @Column({
    name: 'work_model_preference',
    type: 'enum',
    enum: WorkModel,
    nullable: true,
  })
  workModelPreference: WorkModel | null;

  /**
   * MySQL devolve `bigint` como string para preservar precisão.
   * Converta para número apenas na camada de resposta, se necessário.
   */
  @Column({
    name: 'desired_salary_cents',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  desiredSalaryCents: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'BRL' })
  currency: string;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
