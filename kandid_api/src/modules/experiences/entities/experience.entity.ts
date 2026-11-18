import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { Profile } from '../../profiles/entities/profile.entity.js';

/**
 * Experiência profissional do perfil.
 *
 * Regras de negócio (implementar no `ExperiencesService`):
 * - A experiência sempre pertence a um perfil; `profile_id` é derivado do JWT.
 * - `start_date` é obrigatória.
 * - Se `is_current = true`, `end_date` deve ser `null`.
 * - Se `is_current = false`, `end_date` é obrigatória e >= `start_date`.
 * - `sort_order` define a ordem de exibição (menor primeiro).
 */
@Entity({ name: 'experiences' })
export class Experience {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar', length: 36 })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'company_name', type: 'varchar', length: 160 })
  companyName: string;

  @Column({ name: 'role', type: 'varchar', length: 160 })
  role: string;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: ContractType,
    nullable: true,
  })
  employmentType: ContractType | null;

  @Column({
    name: 'work_model',
    type: 'enum',
    enum: WorkModel,
    nullable: true,
  })
  workModel: WorkModel | null;

  @Column({ name: 'location', type: 'varchar', length: 160, nullable: true })
  location: string | null;

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

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
