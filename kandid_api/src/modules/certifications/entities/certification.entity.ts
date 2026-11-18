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
 * Certificação do perfil.
 *
 * Regras de negócio (implementar no `CertificationsService`):
 * - `profile_id` é derivado do JWT; nunca aceite no body.
 * - `issue_date` é obrigatória; `expiry_date`, quando informada, deve ser >= `issue_date`.
 * - `credential_url` deve ser uma URL válida quando presente.
 * - Não é necessário validar se a certificação expirou: o dado é histórico.
 */
@Entity({ name: 'certifications' })
export class Certification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar', length: 36 })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'name', type: 'varchar', length: 160 })
  name: string;

  @Column({ name: 'issuer', type: 'varchar', length: 160 })
  issuer: string;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  /** MySQL devolve `date` como string `YYYY-MM-DD`. */
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({
    name: 'credential_url',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  credentialUrl: string | null;

  @Column({
    name: 'credential_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  credentialId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
