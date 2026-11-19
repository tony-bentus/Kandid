import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { ResumeSnapshot } from '../../ats/engine/types.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Resume } from './resume.entity.js';

/**
 * Versão imutável e append-only do currículo (ADR 0005 `:57-76`).
 *
 * `content_snapshot` é gravado na criação e nunca reescrito; `version` começa
 * em 1 e incrementa sob lock em `resumes`. `ats_score` existe por fidelidade à
 * spec, mas permanece `NULL` nesta sprint — o score vigente vive em
 * `ats_analyses`. Não há `@UpdateDateColumn`.
 */
@Entity({ name: 'resume_versions' })
@Unique('UQ_resume_versions_resume_version', ['resumeId', 'version'])
@Index('IX_resume_versions_job_id', ['jobId'])
export class ResumeVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resume_id', type: 'varchar', length: 36 })
  resumeId: string;

  @ManyToOne(() => Resume, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'resume_id',
    foreignKeyConstraintName: 'FK_resume_versions_resume',
  })
  resume: Resume;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'job_id', type: 'varchar', length: 36, nullable: true })
  jobId: string | null;

  @ManyToOne(() => Job, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'job_id',
    foreignKeyConstraintName: 'FK_resume_versions_job',
  })
  job: Job | null;

  @Column({ name: 'content_snapshot', type: 'json' })
  contentSnapshot: ResumeSnapshot;

  @Column({ name: 'ats_score', type: 'int', nullable: true })
  atsScore: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
