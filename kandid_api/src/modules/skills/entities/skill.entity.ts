import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SkillCategory } from '../../../common/enums/skill-category.enum.js';

/**
 * Catálogo global de skills, semeado pelo projeto (não é CRUD do usuário).
 *
 * Regras de negócio (implementar no `SkillsService` / seed):
 * - `name` e `slug` são únicos.
 * - `aliases` é um array JSON de strings usado pelo motor ATS para matching.
 * - O usuário só lê o catálogo; nunca cria/edita skills pela API.
 */
@Entity({ name: 'skills' })
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_skills_name', { unique: true })
  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  @Index('UQ_skills_slug', { unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 80 })
  slug: string;

  @Column({ name: 'category', type: 'enum', enum: SkillCategory })
  category: SkillCategory;

  @Column({ name: 'aliases', type: 'json' })
  aliases: string[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
