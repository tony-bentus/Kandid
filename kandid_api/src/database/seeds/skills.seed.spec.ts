import type { DataSource } from 'typeorm';
import { SkillCategory } from '../../common/enums/skill-category.enum.js';
import { SKILLS_SEED, seedSkills } from './skills.seed.js';

const aliasesOf = (name: string): string[] => {
  const entry = SKILLS_SEED.find((item) => item.name === name);

  if (!entry) {
    throw new Error(`Skill ${name} is missing from the catalog seed`);
  }

  return entry.aliases;
};

describe('SKILLS_SEED', () => {
  it('has at least 80 entries with unique names and slugs', () => {
    expect(SKILLS_SEED.length).toBeGreaterThanOrEqual(80);

    const names = SKILLS_SEED.map((entry) => entry.name);
    const slugs = SKILLS_SEED.map((entry) => entry.slug);

    expect(new Set(names).size).toBe(names.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('covers every skill category', () => {
    const categories = new Set(SKILLS_SEED.map((entry) => entry.category));

    for (const category of Object.values(SkillCategory)) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it('contains the mandatory aliases from the specification', () => {
    expect(aliasesOf('JavaScript')).toEqual(['JS', 'ECMAScript']);
    expect(aliasesOf('TypeScript')).toEqual(['TS']);
    expect(aliasesOf('Node.js')).toEqual(['Node', 'NodeJS']);
    expect(aliasesOf('C#')).toEqual(['CSharp', 'DotNet C#']);
    expect(aliasesOf('.NET')).toEqual(['DotNet', 'dotnet']);
    expect(aliasesOf('C++')).toEqual(['CPP']);
    expect(aliasesOf('PostgreSQL')).toEqual(['Postgres']);
    expect(aliasesOf('Kubernetes')).toEqual(['K8s']);
  });

  it('has all aliases as non-empty strings', () => {
    for (const entry of SKILLS_SEED) {
      for (const alias of entry.aliases) {
        expect(alias.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('seedSkills', () => {
  it('upserts the whole catalog keyed by slug', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const dataSource = {
      getRepository: () => ({ upsert }),
    } as unknown as DataSource;

    await seedSkills(dataSource);

    expect(upsert).toHaveBeenCalledWith([...SKILLS_SEED], ['slug']);
  });
});
