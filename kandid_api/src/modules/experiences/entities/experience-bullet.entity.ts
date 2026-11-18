import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Experience } from './experience.entity.js';

/**
 * Conquista (bullet) de uma experiência. Uma conquista por linha.
 *
 * Regras de negócio (implementar no `ExperiencesService`):
 * - `text` tem no máximo 500 caracteres e deve descrever UMA conquista.
 * - A bullet pertence à experiência; valide a experiência pelo `userId` do JWT.
 * - `sort_order` define a ordem de exibição.
 * - `ON DELETE CASCADE`: apagar a experiência apaga as bullets.
 */
@Entity({ name: 'experience_bullets' })
export class ExperienceBullet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'experience_id', type: 'varchar', length: 36 })
  experienceId: string;

  @ManyToOne(() => Experience, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'experience_id' })
  experience: Experience;

  @Column({ name: 'text', type: 'varchar', length: 500 })
  text: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
