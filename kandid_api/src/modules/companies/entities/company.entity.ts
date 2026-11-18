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
import { CompanyKind } from '../../../common/enums/company-kind.enum.js';
import { CompanySize } from '../../../common/enums/company-size.enum.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Empresa cadastrada pelo usuário no pipeline de vagas.
 *
 * `user_id` vem sempre do JWT e nunca é aceito no body. Toda consulta deve
 * ser escopada pelo usuário autenticado.
 */
@Entity({ name: 'companies' })
@Index('UQ_companies_user_name', ['userId', 'name'], { unique: true })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'name', type: 'varchar', length: 160 })
  name: string;

  @Column({ name: 'kind', type: 'enum', enum: CompanyKind })
  kind: CompanyKind;

  @Column({ name: 'website', type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ name: 'industry', type: 'varchar', length: 120, nullable: true })
  industry: string | null;

  @Column({
    name: 'size',
    type: 'enum',
    enum: CompanySize,
    nullable: true,
  })
  size: CompanySize | null;

  @Column({ name: 'location', type: 'varchar', length: 160, nullable: true })
  location: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
