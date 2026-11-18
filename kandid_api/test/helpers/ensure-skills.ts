import type { DataSource } from 'typeorm';
import { seedSkills } from '../../src/database/seeds/skills.seed.js';

/**
 * Garante que o catálogo somente leitura esteja semeado antes de testes que
 * buscam skills ou criam vínculos. O seed é idempotente e nunca é apagado pela
 * suíte: ele é compartilhado por todas as suítes e2e em paralelo.
 */
export async function ensureSkills(dataSource: DataSource): Promise<void> {
  await seedSkills(dataSource);
}
