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
import { InterviewOutcome } from '../../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import { InterviewType } from '../../../common/enums/interview-type.enum.js';
import { Application } from '../../applications/entities/application.entity.js';

/**
 * Entrevista de uma rodada de candidatura (KAN-52).
 *
 * Não possui `user_id`: o escopo vem de `application.user_id`. É mutável, mas
 * nenhuma operação desta entidade toca `applications`, histórico de status ou
 * as datas `applied_at`/`closed_at`. Nomes de FK/índices idênticos à migration.
 */
@Entity({ name: 'interviews' })
@Unique('UQ_interviews_application_round', ['applicationId', 'round'])
@Index('IX_interviews_application_round_scheduled', [
  'applicationId',
  'round',
  'scheduledAt',
  'id',
])
export class Interview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'varchar', length: 36 })
  applicationId: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'FK_interviews_application',
  })
  application: Application;

  @Column({ name: 'round', type: 'int' })
  round: number;

  @Column({ name: 'type', type: 'enum', enum: InterviewType })
  type: InterviewType;

  @Column({ name: 'scheduled_at', type: 'datetime', precision: 6 })
  scheduledAt: Date;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'interviewer_name', type: 'varchar', length: 120, nullable: true })
  interviewerName: string | null;

  @Column({ name: 'interviewer_role', type: 'varchar', length: 120, nullable: true })
  interviewerRole: string | null;

  @Column({ name: 'meeting_url', type: 'varchar', length: 255, nullable: true })
  meetingUrl: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InterviewStatus,
    default: InterviewStatus.SCHEDULED,
  })
  status: InterviewStatus;

  @Column({ name: 'feedback', type: 'text', nullable: true })
  feedback: string | null;

  @Column({
    name: 'outcome',
    type: 'enum',
    enum: InterviewOutcome,
    default: InterviewOutcome.PENDING,
  })
  outcome: InterviewOutcome;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
