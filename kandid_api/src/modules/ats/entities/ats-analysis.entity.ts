import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity.js';
import { ResumeVersion } from '../../resumes/entities/resume-version.entity.js';

/**
 * Resultado de uma execução do motor ATS sobre um snapshot imutável.
 *
 * Append-only: reanalisar insere uma nova linha; nunca existe `UPDATE`,
 * `DELETE` ou `updated_at`. O score vive aqui — `resume_version.ats_score`
 * permanece `NULL` (ADR 0005, decisões 10 e 11).
 */
@Entity({ name: 'ats_analyses' })
@Index('IX_ats_analyses_version_created', [
  'resumeVersionId',
  'createdAt',
  'id',
])
@Index('IX_ats_analyses_job_created', ['jobId', 'createdAt', 'id'])
export class AtsAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resume_version_id', type: 'varchar', length: 36 })
  resumeVersionId: string;

  @ManyToOne(() => ResumeVersion, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
    nullable: false,
  })
  @JoinColumn({
    name: 'resume_version_id',
    foreignKeyConstraintName: 'FK_ats_analyses_resume_version',
  })
  resumeVersion: ResumeVersion;

  @Column({ name: 'job_id', type: 'varchar', length: 36 })
  jobId: string;

  @ManyToOne(() => Job, {
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
    nullable: false,
  })
  @JoinColumn({
    name: 'job_id',
    foreignKeyConstraintName: 'FK_ats_analyses_job',
  })
  job: Job;

  @Column({ name: 'score', type: 'int' })
  score: number;

  /** JSON produzido pelo scorer (dimensões, pesos e renormalização). */
  @Column({ name: 'breakdown', type: 'json' })
  breakdown: unknown;

  /** JSON produzido pelo `runChecks`, na ordem fixa do ADR. */
  @Column({ name: 'checks', type: 'json' })
  checks: unknown;

  @Column({ name: 'matched_keywords', type: 'json' })
  matchedKeywords: unknown;

  @Column({ name: 'missing_keywords', type: 'json' })
  missingKeywords: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
