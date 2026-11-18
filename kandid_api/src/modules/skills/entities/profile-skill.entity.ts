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
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';
import { Profile } from '../../profiles/entities/profile.entity.js';
import { Skill } from './skill.entity.js';

/**
 * Vínculo entre o perfil e uma skill do catálogo global.
 *
 * Regras de negócio (implementar no `SkillsService`):
 * - `unique(profile_id, skill_id)`: não duplicar a mesma skill no perfil.
 * - `skill_id` deve existir no catálogo (senão 404/400).
 * - `level` é obrigatório.
 * - `years_experience`: 0 a 99.9, no máximo uma casa decimal.
 * - `last_used_year` não pode estar no futuro.
 */
@Entity({ name: 'profile_skills' })
@Index('UQ_profile_skills_profile_skill', ['profileId', 'skillId'], {
  unique: true,
})
export class ProfileSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'varchar', length: 36 })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'skill_id', type: 'varchar', length: 36 })
  skillId: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @Column({ name: 'level', type: 'enum', enum: SkillLevel })
  level: SkillLevel;

  /** MySQL devolve `decimal` como string; converta para número na resposta. */
  @Column({
    name: 'years_experience',
    type: 'decimal',
    precision: 4,
    scale: 1,
    nullable: true,
  })
  yearsExperience: string | null;

  @Column({ name: 'last_used_year', type: 'smallint', nullable: true })
  lastUsedYear: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
