import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';
import { Profile } from '../../profiles/entities/profile.entity.js';

/**
 * Idioma do perfil.
 *
 * Regras de negócio (implementar no `LanguagesService`):
 * - `profile_id` é derivado do JWT; nunca aceite no body.
 * - `proficiency` é obrigatória.
 * - Evite duplicar o mesmo idioma no perfil (compare `name` sem caixa/acentos).
 */
@Entity({ name: 'languages' })
export class Language {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar', length: 36 })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'proficiency', type: 'enum', enum: LanguageProficiency })
  proficiency: LanguageProficiency;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
