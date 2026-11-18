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
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Candidatura de uma vaga do usuário autenticado.
 *
 * Toda consulta é escopada por `userId`. `job_id` usa `RESTRICT` para preservar
 * a auditoria da vaga; `resume_version_id` fica reservado até a Sprint 5.
 */
@Entity({ name: 'applications' })
@Unique('UQ_applications_user_job', ['userId', 'jobId'])
@Index('IX_applications_user_created', ['userId', 'createdAt'])
@Index('IX_applications_user_status', ['userId', 'status'])
@Index('IX_applications_job_id', ['jobId'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_applications_user',
  })
  user: User;

  @Column({ name: 'job_id', type: 'varchar', length: 36 })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'job_id',
    foreignKeyConstraintName: 'FK_applications_job',
  })
  job: Job;

  @Column({ name: 'status', type: 'enum', enum: ApplicationStatus })
  status: ApplicationStatus;

  /** MySQL devolve `date` como string `YYYY-MM-DD` (dateStrings: ['DATE']). */
  @Column({ name: 'applied_at', type: 'date', nullable: true })
  appliedAt: string | null;

  /** Reservado para a Sprint 5; sem FK nesta sprint. */
  @Column({ name: 'resume_version_id', type: 'varchar', length: 36, nullable: true })
  resumeVersionId: string | null;

  /** MySQL devolve `bigint` como string para preservar precisão. */
  @Column({
    name: 'proposed_salary_cents',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  proposedSalaryCents: string | null;

  /** MySQL devolve `bigint` como string para preservar precisão. */
  @Column({
    name: 'offered_salary_cents',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  offeredSalaryCents: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'BRL' })
  currency: string;

  @Column({ name: 'salary_period', type: 'enum', enum: SalaryPeriod })
  salaryPeriod: SalaryPeriod;

  /** Array de strings, validado na aplicação (json não tem schema no MySQL). */
  @Column({ name: 'benefits', type: 'json', nullable: true })
  benefits: string[] | null;

  @Column({ name: 'next_step_at', type: 'datetime', precision: 6, nullable: true })
  nextStepAt: Date | null;

  @Column({ name: 'last_contact_at', type: 'datetime', precision: 6, nullable: true })
  lastContactAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'closed_at', type: 'datetime', precision: 6, nullable: true })
  closedAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
