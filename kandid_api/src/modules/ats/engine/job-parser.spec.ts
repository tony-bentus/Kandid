import { Seniority } from '../../../common/enums/seniority.enum.js';
import { parseJob } from './job-parser.js';
import type { JobRequirement, SkillCatalogEntry, SkillMatch } from './types.js';

const CATALOG: readonly SkillCatalogEntry[] = [
  { id: 'skill-node', name: 'Node.js', aliases: ['Node', 'NodeJS'] },
  { id: 'skill-ts', name: 'TypeScript', aliases: ['TS'] },
  { id: 'skill-k8s', name: 'Kubernetes', aliases: ['K8s'] },
  { id: 'skill-docker', name: 'Docker', aliases: [] },
  { id: 'skill-pg', name: 'PostgreSQL', aliases: ['Postgres'] },
];

const parse = (
  description: string,
  skills: readonly SkillCatalogEntry[] = CATALOG,
): JobRequirement => parseJob({ description, skills });

const ids = (matches: readonly SkillMatch[]): string[] =>
  matches.map((match) => match.skillId).sort();

const REALISTIC_DESCRIPTION = [
  'Requisitos: Node.js, TypeScript e PostgreSQL',
  'Diferenciais: Kubernetes e Docker',
  'Experiência de 5+ anos em desenvolvimento backend.',
  'Vaga para profissional Sênior.',
].join('\n');

describe('parseJob', () => {
  it('splits required and nice-to-have sections and keeps the skill ids', () => {
    const result = parse(
      ['Requisitos: Node.js, TypeScript', 'Diferenciais: Kubernetes'].join('\n'),
    );

    expect(ids(result.required)).toEqual(['skill-node', 'skill-ts']);
    expect(ids(result.niceToHave)).toEqual(['skill-k8s']);
    expect(result.required.every((match) => match.skillId !== 'skill-k8s')).toBe(
      true,
    );
    expect(result.niceToHave[0]?.name).toBe('Kubernetes');
  });

  it('recognizes every required section header from the spec', () => {
    for (const header of [
      'Requisitos',
      'Requirements',
      'Must have',
      'Obrigatório',
      'Necessário',
    ]) {
      const result = parse(`${header}:\nNode.js`);

      expect(ids(result.required)).toEqual(['skill-node']);
      expect(result.niceToHave).toEqual([]);
    }
  });

  it('recognizes every nice-to-have section header from the spec', () => {
    for (const header of [
      'Diferenciais',
      'Nice to have',
      'Desejável',
      'Plus',
      'Preferencial',
    ]) {
      const result = parse(`${header}:\nKubernetes`);

      expect(ids(result.niceToHave)).toEqual(['skill-k8s']);
      expect(result.required).toEqual([]);
    }
  });

  it('classifies every match as required when no section is recognized', () => {
    const result = parse(
      'Buscamos pessoa com Node.js e Kubernetes para o time de plataforma.',
    );

    expect(ids(result.required)).toEqual(['skill-k8s', 'skill-node']);
    expect(result.niceToHave).toEqual([]);
  });

  it('tests aliases from longest to shortest, avoiding partial matches', () => {
    const result = parse('Requisitos: PostgreSQL');

    expect(result.required).toHaveLength(1);
    // "postgres" is a prefix of "postgresql"; the longest alias/name must win.
    expect(result.required[0]?.matchedAs.toLowerCase()).toBe('postgresql');
  });

  it('deduplicates by skillId when name and aliases repeat', () => {
    const result = parse('Requisitos: Node.js, NodeJS e Node');

    expect(result.required).toHaveLength(1);
    expect(result.required[0]?.skillId).toBe('skill-node');
  });

  it('extracts years with "5+ anos" and "3 years"', () => {
    expect(parse('Requisitos: Node.js\n5+ anos de experiência').yearsRequired).toBe(
      5,
    );
    expect(parse('Requisitos: Node.js\n3 years of experience').yearsRequired).toBe(
      3,
    );
  });

  it('uses the largest year count when the description has more than one', () => {
    const result = parse('3 years of experience, mas a vaga pede 5+ anos');

    expect(result.yearsRequired).toBe(5);
  });

  it('returns null for years when the description does not mention them', () => {
    expect(parse('Requisitos: Node.js e TypeScript').yearsRequired).toBeNull();
  });

  it('detects the seniority hint from an explicit Seniority member', () => {
    expect(parse('Vaga para profissional Sênior').seniorityHint).toBe(
      Seniority.SENIOR,
    );
    expect(parse('Vaga Principal de engenharia').seniorityHint).toBe(
      Seniority.PRINCIPAL,
    );
  });

  it('returns null for seniority when the description does not mention it', () => {
    expect(parse('Requisitos: Node.js').seniorityHint).toBeNull();
  });

  it('keeps the provisional education/certification/language fields typed', () => {
    const result = parse(REALISTIC_DESCRIPTION);

    expect(typeof result.educationRequired).toBe('boolean');
    expect(typeof result.certificationRequired).toBe('boolean');
    expect(Array.isArray(result.languagesRequired)).toBe(true);
  });

  it('is deterministic for the same description and catalog', () => {
    expect(parse(REALISTIC_DESCRIPTION)).toEqual(parse(REALISTIC_DESCRIPTION));
  });
});
