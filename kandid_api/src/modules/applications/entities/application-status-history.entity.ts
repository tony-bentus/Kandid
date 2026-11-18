import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { Application } from './application.entity.js';

/**
 * Histórico append-only de transições de status.
 *
 * Não existe `@UpdateDateColumn`: `changed_at` é gravado uma única vez pelo
 * service, junto com a atualização da candidatura, na mesma transação.
 */
@Entity({ name: 'application_status_history' })
@Index('IX_application_status_history_app_changed', [
  'applicationId',
  'changedAt',
  'id',
])
export class ApplicationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'varchar', length: 36 })
  applicationId: string;

  @ManyToOne(() => Application, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'FK_application_status_history_application',
  })
  application: Application;

  /** Nullable reservado para importação/estado desconhecido (ADR 0004). */
  @Column({
    name: 'from_status',
    type: 'enum',
    enum: ApplicationStatus,
    nullable: true,
  })
  fromStatus: ApplicationStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: ApplicationStatus })
  toStatus: ApplicationStatus;

  @Column({ name: 'note', type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'changed_at', type: 'datetime', precision: 6 })
  changedAt: Date;
}
