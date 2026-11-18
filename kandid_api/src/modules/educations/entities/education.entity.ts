import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from '../../profiles/entities/profile.entity.js';

/**
 * Formação acadêmica do perfil.
 *
 * Regras de negócio (implementar no `EducationsService`):
 * - `profile_id` é derivado do JWT; nunca aceite no body.
 * - `start_date` é obrigatória.
 * - Se `is_current = true`, `end_date` deve ser `null`.
 * - Se `is_current = false`, `end_date` é obrigatória e >= `start_date`.
 */
@Entity({ name: 'educations' })
export class Education {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar', length: 36 })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'institution', type: 'varchar', length: 160 })
  institution: string;

  @Column({ name: 'degree', type: 'varchar', length: 160 })
  degree: string;

  @Column({ name: 'field_of_study', type: 'varchar', length: 160 })
  fieldOfStudy: string;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
