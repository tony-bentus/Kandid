import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { SkillCategory } from '../../../common/enums/skill-category.enum.js';
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { runChecks } from './checks.js';
import type { ResumeSnapshot, StructuralCheck } from './types.js';

type SnapshotExperience = ResumeSnapshot['experiences'][number];
type SnapshotSkill = ResumeSnapshot['skills'][number];

const EXPECTED_CHECK_IDS = [
  'has-summary',
  'has-contact',
  'has-experience',
  'has-highlights',
  'dates-consistent',
  'no-empty-required-sections',
  'bullet-length',
  'has-skills',
  'target-role-defined',
  'no-duplicate-skills',
] as const;

const makeExperience = (
  overrides: Partial<SnapshotExperience> = {},
): SnapshotExperience => ({
  company: 'Acme',
  role: 'Backend Developer',
  employmentType: ContractType.CLT,
  workModel: WorkModel.REMOTE,
  location: 'Remoto',
  startDate: '2021-03',
  endDate: null,
  current: true,
  highlights: ['Reduzi a latência da API em 40%'],
  ...overrides,
});

const makeSkill = (overrides: Partial<SnapshotSkill> = {}): SnapshotSkill => ({
  name: 'Node.js',
  category: SkillCategory.FRAMEWORK,
  level: SkillLevel.ADVANCED,
  years: 5,
  ...overrides,
});

const makeSnapshot = (overrides: Partial<ResumeSnapshot> = {}): ResumeSnapshot => ({
  schemaVersion: '1.0',
  targetRole: 'Desenvolvedor Backend Sênior',
  generatedAt: '2026-11-01T12:00:00.000Z',
  candidate: {
    name: 'Ana Souza',
    headline: 'Backend Developer',
    email: 'ana.souza@exemplo.com',
    phone: '+55 11 99999-0000',
    location: 'São Paulo, SP, Brasil',
    links: {
      linkedin: 'https://linkedin.com/in/ana-souza',
      github: 'https://github.com/ana-souza',
      portfolio: 'https://ana-souza.dev',
    },
  },
  summary: 'Desenvolvedora backend com foco em Node.js e TypeScript.',
  skills: [makeSkill()],
  experiences: [makeExperience()],
  education: [],
  certifications: [],
  languages: [{ name: 'Inglês', proficiency: LanguageProficiency.ADVANCED }],
  projects: [],
  seniority: Seniority.SENIOR,
  ...overrides,
});

const byId = (checks: readonly StructuralCheck[], id: string): StructuralCheck => {
  const check = checks.find((item) => item.id === id);

  if (check === undefined) {
    throw new Error(`Check ${id} is missing from runChecks output`);
  }

  return check;
};

describe('runChecks', () => {
  it('returns exactly the ten check ids in the spec/ADR order', () => {
    const checks = runChecks(makeSnapshot());

    expect(checks.map((check) => check.id)).toEqual([...EXPECTED_CHECK_IDS]);
  });

  it('passes every check with detail null for a complete snapshot', () => {
    const checks = runChecks(makeSnapshot());

    expect(checks.every((check) => check.passed)).toBe(true);
    expect(checks.every((check) => check.detail === null)).toBe(true);
  });

  it('has-summary fails when the summary is empty', () => {
    const checks = runChecks(makeSnapshot({ summary: '' }));

    expect(byId(checks, 'has-summary').passed).toBe(false);
    expect(byId(checks, 'has-summary').detail).toEqual(expect.any(String));
  });

  it('has-contact requires both e-mail and phone', () => {
    const onlyEmail = runChecks(
      makeSnapshot({
        candidate: { ...makeSnapshot().candidate, phone: '' },
      }),
    );
    const onlyPhone = runChecks(
      makeSnapshot({
        candidate: { ...makeSnapshot().candidate, email: '' },
      }),
    );

    expect(byId(onlyEmail, 'has-contact').passed).toBe(false);
    expect(byId(onlyPhone, 'has-contact').passed).toBe(false);
    expect(byId(runChecks(makeSnapshot()), 'has-contact').passed).toBe(true);
  });

  it('has-experience fails when there is no experience', () => {
    const checks = runChecks(makeSnapshot({ experiences: [] }));

    expect(byId(checks, 'has-experience').passed).toBe(false);
  });

  it('has-highlights fails when no experience has highlights', () => {
    const checks = runChecks(
      makeSnapshot({ experiences: [makeExperience({ highlights: [] })] }),
    );

    expect(byId(checks, 'has-highlights').passed).toBe(false);
  });

  it('dates-consistent fails when an experience has no startDate', () => {
    const checks = runChecks(
      makeSnapshot({ experiences: [makeExperience({ startDate: '' })] }),
    );

    expect(byId(checks, 'dates-consistent').passed).toBe(false);
  });

  it('dates-consistent fails when a current experience has an endDate', () => {
    const checks = runChecks(
      makeSnapshot({
        experiences: [makeExperience({ current: true, endDate: '2025-12' })],
      }),
    );

    expect(byId(checks, 'dates-consistent').passed).toBe(false);
  });

  it('dates-consistent fails when startDate is after endDate', () => {
    const checks = runChecks(
      makeSnapshot({
        experiences: [
          makeExperience({
            current: false,
            startDate: '2024-01',
            endDate: '2023-01',
          }),
        ],
      }),
    );

    expect(byId(checks, 'dates-consistent').passed).toBe(false);
  });

  it('no-empty-required-sections fails when an existing entry has no meaningful content', () => {
    const checks = runChecks(
      makeSnapshot({
        experiences: [makeExperience({ company: '', role: '', highlights: [] })],
      }),
    );

    expect(byId(checks, 'no-empty-required-sections').passed).toBe(false);
    expect(byId(checks, 'no-empty-required-sections').detail).toContain(
      'experiences',
    );
  });

  it('no-empty-required-sections passes for empty optional arrays', () => {
    const checks = runChecks(makeSnapshot({ certifications: [], projects: [] }));

    expect(byId(checks, 'no-empty-required-sections').passed).toBe(true);
    expect(byId(checks, 'no-empty-required-sections').detail).toBeNull();
  });

  it('an empty summary fails has-summary, not no-empty-required-sections', () => {
    const checks = runChecks(makeSnapshot({ summary: '' }));

    expect(byId(checks, 'has-summary').passed).toBe(false);
    expect(byId(checks, 'no-empty-required-sections').passed).toBe(true);
  });

  it('bullet-length accepts 220 characters and rejects 221', () => {
    const atLimit = runChecks(
      makeSnapshot({
        experiences: [makeExperience({ highlights: ['a'.repeat(220)] })],
      }),
    );
    const overLimit = runChecks(
      makeSnapshot({
        experiences: [makeExperience({ highlights: ['a'.repeat(221)] })],
      }),
    );

    expect(byId(atLimit, 'bullet-length').passed).toBe(true);
    expect(byId(atLimit, 'bullet-length').detail).toBeNull();
    expect(byId(overLimit, 'bullet-length').passed).toBe(false);
    expect(byId(overLimit, 'bullet-length').detail).toContain('220');
  });

  it('has-skills fails when the skills list is empty', () => {
    const checks = runChecks(makeSnapshot({ skills: [] }));

    expect(byId(checks, 'has-skills').passed).toBe(false);
  });

  it('target-role-defined fails when targetRole is an empty string', () => {
    const checks = runChecks(makeSnapshot({ targetRole: '' }));

    expect(byId(checks, 'target-role-defined').passed).toBe(false);
  });

  it('no-duplicate-skills fails when the same skill is repeated', () => {
    const checks = runChecks(
      makeSnapshot({ skills: [makeSkill(), makeSkill()] }),
    );

    expect(byId(checks, 'no-duplicate-skills').passed).toBe(false);
  });

  it('explains every failing check and keeps detail null on passing ones', () => {
    const checks = runChecks(
      makeSnapshot({
        targetRole: '',
        summary: '',
        skills: [],
        experiences: [],
        candidate: { ...makeSnapshot().candidate, email: '', phone: '' },
      }),
    );

    for (const check of checks) {
      if (check.passed) {
        expect(check.detail).toBeNull();
      } else {
        expect(check.detail).toEqual(expect.any(String));
        expect((check.detail ?? '').length).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for the same snapshot', () => {
    const snapshot = makeSnapshot();

    expect(runChecks(snapshot)).toEqual(runChecks(snapshot));
  });
});
