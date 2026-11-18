import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Skill } from '../../skills/entities/skill.entity.js';
import { Job } from './job.entity.js';

/**
 * Vínculo entre vaga e skill do catálogo global.
 *
 * Sem `id` e sem timestamps: a PK composta `(job_id, skill_id)` garante que a
 * mesma skill não seja adicionada duas vezes à mesma vaga. A relação `skill`
 * permite carregar o catálogo com `relations: { skill: true }`.
 */
@Entity({ name: 'job_skills' })
export class JobSkill {
  @PrimaryColumn({ name: 'job_id', type: 'varchar', length: 36 })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @PrimaryColumn({ name: 'skill_id', type: 'varchar', length: 36 })
  skillId: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired: boolean;
}
