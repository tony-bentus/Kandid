import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { JobSource } from '../../../common/enums/job-source.enum.js';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { Company } from '../../companies/entities/company.entity.js';
import { Recruiter } from '../../recruiters/entities/recruiter.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Vaga acompanhada pelo usuário no pipeline.
 *
 * Não existe campo `status` nesta sprint. `company_id` usa `RESTRICT` para
 * impedir a exclusão silenciosa de empresa com histórico de vagas.
 */
@Entity({ name: 'jobs' })
@Index('IX_jobs_user_created', ['userId', 'createdAt'])
@Index('IX_jobs_user_company', ['userId', 'companyId'])
@Index('IX_jobs_user_posted', ['userId', 'postedAt'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'company_id', type: 'varchar', length: 36 })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({
    name: 'recruiter_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  recruiterId: string | null;

  @ManyToOne(() => Recruiter, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recruiter_id' })
  recruiter: Recruiter | null;

  @Column({ name: 'title', type: 'varchar', length: 160 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'seniority',
    type: 'enum',
    enum: Seniority,
    nullable: true,
  })
  seniority: Seniority | null;

  @Column({
    name: 'work_model',
    type: 'enum',
    enum: WorkModel,
    nullable: true,
  })
  workModel: WorkModel | null;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: ContractType,
    nullable: true,
  })
  contractType: ContractType | null;

  @Column({ name: 'location', type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Column({ name: 'source', type: 'enum', enum: JobSource })
  source: JobSource;

  @Column({ name: 'source_url', type: 'varchar', length: 255, nullable: true })
  sourceUrl: string | null;

  /**
   * MySQL devolve `bigint` como string para preservar precisão.
   * Converta para número apenas na camada de resposta.
   */
  @Column({
    name: 'salary_range_min_cents',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  salaryRangeMinCents: string | null;

  /**
   * MySQL devolve `bigint` como string para preservar precisão.
   * Converta para número apenas na camada de resposta.
   */
  @Column({
    name: 'salary_range_max_cents',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  salaryRangeMaxCents: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'BRL' })
  currency: string;

  @Column({ name: 'salary_period', type: 'enum', enum: SalaryPeriod })
  salaryPeriod: SalaryPeriod;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'posted_at', type: 'date', nullable: true })
  postedAt: string | null;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'application_deadline', type: 'date', nullable: true })
  applicationDeadline: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
