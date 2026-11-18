import AppDataSource from '../data-source.js';
import { seedSkills } from './skills.seed.js';

try {
  await AppDataSource.initialize();
  await seedSkills(AppDataSource);
  console.log('Skills catalog seeded successfully.');
} catch (error: unknown) {
  console.error('Failed to seed skills catalog:', error);
  process.exitCode = 1;
} finally {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}
