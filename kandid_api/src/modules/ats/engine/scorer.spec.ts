import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { SkillCategory } from '../../../common/enums/skill-category.enum.js';
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { score } from './scorer.js';
import type {
  AtsScoreResult,
  JobRequirement,
  ResumeSnapshot,
  ScoreDimension,
  SkillMatch,
  StructuralCheck,
  WeightedSection,
} from './types.js';

type SnapshotExperience = ResumeSnapshot['experiences'][number];
type SnapshotSkill = ResumeSnapshot['skills'][number];

const DIMENSIONS = [
  'requiredSkills',
  'niceToHaveSkills',
  'seniority',
  'yearsExperience',
  'educationCertification',
  'languages',
  'resumeStructure',
] as const;

const WEIGHTS = [35, 10, 20, 15, 10, 5, 5] as const;

const CHECK_IDS = [
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
  startDate: '2021-01',
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
  generatedAt: '2026-01-15T00:00:00.000Z',
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
  education: [
    {
      institution: 'Universidade X',
      degree: 'Bacharelado',
      fieldOfStudy: 'Ciência da Computação',
      startDate: '2015-02',
      endDate: '2019-12',
      current: false,
    },
  ],
  certifications: [],
  languages: [{ name: 'Inglês', proficiency: LanguageProficiency.ADVANCED }],
  projects: [],
  seniority: Seniority.SENIOR,
  ...overrides,
});

const match = (skillId: string, name: string, weight = 3): SkillMatch => ({
  skillId,
  name,
  matchedAs: name.toLowerCase(),
  weight,
});

const makeJob = (overrides: Partial<JobRequirement> = {}): JobRequirement => ({
  required: [],
  niceToHave: [],
  yearsRequired: null,
  seniorityHint: null,
  educationRequired: false,
  certificationRequired: false,
  languagesRequired: [],
  ...overrides,
});

const section = (
  name: WeightedSection['section'],
  text: string,
  weight: number,
): WeightedSection => ({ section: name, weight, text });

const checks = (passedCount = 10): StructuralCheck[] =>
  CHECK_IDS.map((id, index) => ({
    id,
    passed: index < passedCount,
    detail: index < passedCount ? null : `check ${id} failed`,
  }));

const dimension = (result: AtsScoreResult, name: string): ScoreDimension => {
  const found = result.breakdown.find((item) => item.dimension === name);

  if (found === undefined) {
    throw new Error(`Dimension ${name} is missing from the breakdown`);
  }

  return found;
};

/**
 * Entrada com todas as sete dimensões aplicáveis e plenamente atendidas.
 * Skills usam `weight = 3` (peso máximo de seção) e aparecem em uma seção de
 * peso 3, de modo que a cobertura é 100% em qualquer leitura da fórmula do
 * ADR (`:266-274`).
 */
const perfectInput = (): {
  job: JobRequirement;
  sections: WeightedSection[];
  checks: StructuralCheck[];
  snapshot: ResumeSnapshot;
} => ({
  job: makeJob({
    required: [match('skill-node', 'Node.js'), match('skill-ts', 'TypeScript')],
    niceToHave: [match('skill-docker', 'Docker')],
    yearsRequired: 5,
    seniorityHint: Seniority.SENIOR,
    educationRequired: true,
    languagesRequired: ['Inglês'],
  }),
  sections: [section('recentHighlight', 'Node.js TypeScript Docker', 3)],
  checks: checks(10),
  snapshot: makeSnapshot({
    experiences: [makeExperience({ startDate: '2021-01', current: true })],
  }),
});

describe('score', () => {
  it('returns the seven dimensions with the original 35/10/20/15/10/5/5 weights', () => {
    const result = score({
      job: makeJob(),
      sections: [],
      checks: checks(10),
      snapshot: makeSnapshot(),
    });

    expect(result.breakdown.map((item) => item.dimension)).toEqual([
      ...DIMENSIONS,
    ]);
    expect(result.breakdown.map((item) => item.weight)).toEqual([...WEIGHTS]);
  });

  it('scores 100 when every applicable dimension is fully met', () => {
    const input = perfectInput();
    const result = score(input);

    expect(dimension(result, 'requiredSkills').earned).toBe(100);
    expect(dimension(result, 'niceToHaveSkills').earned).toBe(100);
    expect(dimension(result, 'seniority').earned).toBe(100);
    expect(dimension(result, 'yearsExperience').earned).toBe(100);
    expect(dimension(result, 'educationCertification').earned).toBe(100);
    expect(dimension(result, 'languages').earned).toBe(100);
    expect(dimension(result, 'resumeStructure').earned).toBe(100);
    expect(result.score).toBe(100);
  });

  it('exposes effectiveWeight as weight/W when all dimensions apply', () => {
    const input = perfectInput();
    const result = score(input);

    expect(dimension(result, 'requiredSkills').effectiveWeight).toBeCloseTo(
      0.35,
      10,
    );
    expect(dimension(result, 'niceToHaveSkills').effectiveWeight).toBeCloseTo(
      0.1,
      10,
    );
    expect(dimension(result, 'seniority').effectiveWeight).toBeCloseTo(0.2, 10);
    expect(dimension(result, 'yearsExperience').effectiveWeight).toBeCloseTo(
      0.15,
      10,
    );
    expect(
      dimension(result, 'educationCertification').effectiveWeight,
    ).toBeCloseTo(0.1, 10);
    expect(dimension(result, 'languages').effectiveWeight).toBeCloseTo(0.05, 10);
    expect(dimension(result, 'resumeStructure').effectiveWeight).toBeCloseTo(
      0.05,
      10,
    );

    const total = result.breakdown.reduce(
      (sum, item) => sum + item.effectiveWeight,
      0,
    );

    expect(total).toBeCloseTo(1, 10);
  });

  it('renormalizes the applicable dimensions and zeroes the others', () => {
    const result = score({
      job: makeJob({
        required: [match('skill-node', 'Node.js'), match('skill-ts', 'TypeScript')],
      }),
      sections: [section('recentHighlight', 'Node.js TypeScript', 3)],
      checks: checks(5),
      snapshot: makeSnapshot(),
    });

    expect(dimension(result, 'requiredSkills').applicable).toBe(true);
    expect(dimension(result, 'requiredSkills').effectiveWeight).toBeCloseTo(
      35 / 40,
      10,
    );
    expect(dimension(result, 'resumeStructure').effectiveWeight).toBeCloseTo(
      5 / 40,
      10,
    );

    for (const name of [
      'niceToHaveSkills',
      'seniority',
      'yearsExperience',
      'educationCertification',
      'languages',
    ]) {
      const item = dimension(result, name);

      expect(item.applicable).toBe(false);
      expect(item.earned).toBeNull();
      expect(item.effectiveWeight).toBe(0);
    }

    const total = result.breakdown.reduce(
      (sum, item) => sum + item.effectiveWeight,
      0,
    );

    expect(total).toBeCloseTo(1, 10);
    // 0.875 * 100 (required) + 0.125 * 50 (5 of 10 checks) = 93.75 -> 94
    expect(result.score).toBe(94);
  });

  it('applies 35/10/20/15/10/5/5 and rounds the final score', () => {
    const result = score({
      job: makeJob({
        required: [
          match('skill-node', 'Node.js'),
          match('skill-ts', 'TypeScript'),
          match('skill-k8s', 'Kubernetes'),
        ],
        niceToHave: [match('skill-docker', 'Docker')],
        yearsRequired: 12,
        seniorityHint: Seniority.SENIOR,
        educationRequired: true,
        languagesRequired: ['Inglês'],
      }),
      sections: [section('recentHighlight', 'Node.js TypeScript', 3)],
      checks: checks(7),
      snapshot: makeSnapshot(),
    });

    // `earned` is always a 0..100 percentage (ADR 0005 ruling): 2 of 3 skills,
    // each worth the max section weight 3 -> (3 + 3) / (3 + 3 + 3) = 6/9
    // -> 66.67 -> 67. The 35 is the dimension weight, applied later by
    // `effectiveWeight`.
    expect(dimension(result, 'requiredSkills').earned).toBe(67);
    expect(dimension(result, 'requiredSkills').matched).toEqual([
      'Node.js',
      'TypeScript',
    ]);
    expect(dimension(result, 'requiredSkills').missing).toEqual(['Kubernetes']);
    expect(dimension(result, 'requiredSkills').detail).toContain('2');
    expect(dimension(result, 'requiredSkills').detail).toContain('3');

    // nice-to-have: Docker absent -> 0
    expect(dimension(result, 'niceToHaveSkills').earned).toBe(0);
    expect(dimension(result, 'niceToHaveSkills').missing).toEqual(['Docker']);

    expect(dimension(result, 'seniority').earned).toBe(100);
    // current experience from 2021-01 up to generatedAt 2026-01: ~5 years
    expect(dimension(result, 'yearsExperience').earned).toBe(42);
    expect(dimension(result, 'educationCertification').earned).toBe(100);
    expect(dimension(result, 'languages').earned).toBe(100);
    expect(dimension(result, 'resumeStructure').earned).toBe(70);

    // 0.35*67 + 0.10*0 + 0.20*100 + 0.15*42 + 0.10*100 + 0.05*100 + 0.05*70
    // = 68.25 -> 68
    expect(result.score).toBe(68);
    expect(Number.isInteger(result.score)).toBe(true);
  });

  it('uses the highest section weight for a repeated keyword instead of summing', () => {
    const result = score({
      job: makeJob({
        required: [
          match('skill-node', 'Node.js'),
          match('skill-ts', 'TypeScript'),
          match('skill-k8s', 'Kubernetes'),
        ],
      }),
      sections: [
        section('summary', 'Node.js', 2),
        section('recentHighlight', 'Node.js TypeScript', 3),
      ],
      checks: checks(10),
      snapshot: makeSnapshot(),
    });

    // Node.js appears in weight 2 and 3; it must count once with its best
    // section weight 3. The section weight goes into the ratio, and `earned`
    // is a percentage: (3 + 3) / (3 + 3 + 3) = 6/9 -> 66.67 -> 67.
    // Summing the sections would give (2 + 3 + 3) / 9 = 8/9 -> 89.
    expect(dimension(result, 'requiredSkills').earned).toBe(67);
  });

  it('scores seniority as 100/60/0 and marks it not applicable when unknown', () => {
    const scoreSeniority = (
      candidate: ResumeSnapshot['seniority'],
      required: Seniority | null,
    ): ScoreDimension =>
      dimension(
        score({
          job: makeJob({ seniorityHint: required }),
          sections: [],
          checks: checks(10),
          snapshot: makeSnapshot({ seniority: candidate }),
        }),
        'seniority',
      );

    expect(scoreSeniority(Seniority.SENIOR, Seniority.SENIOR).earned).toBe(100);
    expect(scoreSeniority(Seniority.MID, Seniority.SENIOR).earned).toBe(60);
    expect(scoreSeniority(Seniority.JUNIOR, Seniority.SENIOR).earned).toBe(0);
    expect(scoreSeniority(Seniority.INTERN, Seniority.LEAD).earned).toBe(0);

    const unknownCandidate = scoreSeniority(undefined, Seniority.SENIOR);
    expect(unknownCandidate.applicable).toBe(false);
    expect(unknownCandidate.earned).toBeNull();

    const unknownJob = scoreSeniority(Seniority.SENIOR, null);
    expect(unknownJob.applicable).toBe(false);
    expect(unknownJob.earned).toBeNull();
  });

  it('computes real years from dated experiences using snapshot.generatedAt', () => {
    const yearsDimension = (
      snapshot: ResumeSnapshot,
      yearsRequired: number | null = 12,
    ): ScoreDimension =>
      dimension(
        score({
          job: makeJob({ yearsRequired }),
          sections: [],
          checks: checks(10),
          snapshot,
        }),
        'yearsExperience',
      );

    // 2021-01 -> 2026-01: 60/61 inclusive months (~5 years) of 12 required.
    expect(yearsDimension(makeSnapshot()).earned).toBe(42);

    // Same experience, older generatedAt: ~2 years of 12.
    expect(
      yearsDimension(
        makeSnapshot({ generatedAt: '2023-01-15T00:00:00.000Z' }),
      ).earned,
    ).toBe(17);
  });

  it('ignores skills[].years and uses only experience durations', () => {
    const result = dimension(
      score({
        job: makeJob({ yearsRequired: 12 }),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot({
          // 20 years of Node.js must not replace the ~5 years of experience.
          skills: [makeSkill({ years: 20 })],
        }),
      }),
      'yearsExperience',
    );

    expect(result.earned).toBe(42);
  });

  it('uses generatedAt instead of endDate for a current experience', () => {
    const result = dimension(
      score({
        job: makeJob({ yearsRequired: 12 }),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot({
          experiences: [
            makeExperience({
              startDate: '2021-01',
              endDate: '2019-01',
              current: true,
            }),
          ],
        }),
      }),
      'yearsExperience',
    );

    expect(result.earned).toBe(42);
  });

  it('contributes zero years when startDate is after endDate', () => {
    const result = dimension(
      score({
        job: makeJob({ yearsRequired: 12 }),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot({
          experiences: [
            makeExperience({
              startDate: '2025-01',
              endDate: '2024-01',
              current: false,
            }),
          ],
        }),
      }),
      'yearsExperience',
    );

    expect(result.earned).toBe(0);
  });

  it('marks years as not applicable without a requirement but applicable with zero years when the resume has no dates', () => {
    const notRequired = dimension(
      score({
        job: makeJob({ yearsRequired: null }),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot(),
      }),
      'yearsExperience',
    );

    expect(notRequired.applicable).toBe(false);
    expect(notRequired.earned).toBeNull();

    const noDatedExperiences = dimension(
      score({
        job: makeJob({ yearsRequired: 5 }),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot({ experiences: [] }),
      }),
      'yearsExperience',
    );

    expect(noDatedExperiences.applicable).toBe(true);
    expect(noDatedExperiences.earned).toBe(0);
  });

  it('scores education/certification as 100 when met and 0 when missing', () => {
    const educationDimension = (snapshot: ResumeSnapshot): ScoreDimension =>
      dimension(
        score({
          job: makeJob({ educationRequired: true }),
          sections: [],
          checks: checks(10),
          snapshot,
        }),
        'educationCertification',
      );

    expect(educationDimension(makeSnapshot()).earned).toBe(100);
    expect(educationDimension(makeSnapshot({ education: [] })).earned).toBe(0);

    const certificationDimension = (snapshot: ResumeSnapshot): ScoreDimension =>
      dimension(
        score({
          job: makeJob({ certificationRequired: true }),
          sections: [],
          checks: checks(10),
          snapshot,
        }),
        'educationCertification',
      );

    expect(certificationDimension(makeSnapshot()).earned).toBe(0);
    expect(
      certificationDimension(
        makeSnapshot({
          certifications: [
            {
              name: 'AWS Certified Developer',
              issuer: 'AWS',
              issueDate: '2024-05-01',
              expiryDate: null,
              credentialUrl: null,
              credentialId: null,
            },
          ],
        }),
      ).earned,
    ).toBe(100);

    const notRequired = dimension(
      score({
        job: makeJob(),
        sections: [],
        checks: checks(10),
        snapshot: makeSnapshot(),
      }),
      'educationCertification',
    );

    expect(notRequired.applicable).toBe(false);
    expect(notRequired.earned).toBeNull();
  });

  it('scores languages as 100 when met, 0 when missing and not applicable when absent from the job', () => {
    const languageDimension = (
      snapshot: ResumeSnapshot,
      required: readonly string[],
    ): ScoreDimension =>
      dimension(
        score({
          job: makeJob({ languagesRequired: required }),
          sections: [],
          checks: checks(10),
          snapshot,
        }),
        'languages',
      );

    expect(languageDimension(makeSnapshot(), ['Inglês']).earned).toBe(100);
    expect(
      languageDimension(makeSnapshot({ languages: [] }), ['Inglês']).earned,
    ).toBe(0);

    const notRequired = languageDimension(makeSnapshot(), []);
    expect(notRequired.applicable).toBe(false);
    expect(notRequired.earned).toBeNull();
  });

  it('scores resumeStructure as the proportion of passing checks', () => {
    const structureDimension = (passedCount: number): ScoreDimension =>
      dimension(
        score({
          job: makeJob(),
          sections: [],
          checks: checks(passedCount),
          snapshot: makeSnapshot(),
        }),
        'resumeStructure',
      );

    expect(structureDimension(10).earned).toBe(100);
    expect(structureDimension(7).earned).toBe(70);
    expect(structureDimension(0).earned).toBe(0);
  });

  it('returns matchedKeywords as a deduplicated union and missingKeywords from required only', () => {
    const result = score({
      job: makeJob({
        required: [
          match('skill-node', 'Node.js'),
          match('skill-ts', 'TypeScript'),
          match('skill-k8s', 'Kubernetes'),
        ],
        niceToHave: [match('skill-docker', 'Docker')],
      }),
      sections: [section('recentHighlight', 'Node.js TypeScript Docker', 3)],
      checks: checks(10),
      snapshot: makeSnapshot(),
    });

    expect(result.matchedKeywords).toEqual([
      'Node.js',
      'TypeScript',
      'Docker',
    ]);
    expect(result.missingKeywords).toEqual(['Kubernetes']);
  });

  it('deduplicates a keyword that appears in both required and nice-to-have lists', () => {
    const result = score({
      job: makeJob({
        required: [match('skill-node', 'Node.js')],
        niceToHave: [match('skill-node', 'Node.js')],
      }),
      sections: [section('recentHighlight', 'Node.js', 3)],
      checks: checks(10),
      snapshot: makeSnapshot(),
    });

    expect(result.matchedKeywords).toEqual(['Node.js']);
    expect(result.missingKeywords).toEqual([]);
  });

  it('clamps the score to 0..100 and keeps earned values as integers', () => {
    const zero = score({
      job: makeJob({
        required: [match('skill-k8s', 'Kubernetes')],
        niceToHave: [match('skill-docker', 'Docker')],
        yearsRequired: 12,
        seniorityHint: Seniority.SENIOR,
        educationRequired: true,
        languagesRequired: ['Alemão'],
      }),
      sections: [],
      checks: checks(0),
      snapshot: makeSnapshot({
        experiences: [],
        education: [],
        languages: [],
        seniority: Seniority.JUNIOR,
      }),
    });

    expect(zero.score).toBe(0);

    const hundred = score(perfectInput());
    expect(hundred.score).toBe(100);

    for (const result of [zero, hundred]) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.score)).toBe(true);

      for (const item of result.breakdown) {
        if (item.earned !== null) {
          expect(Number.isInteger(item.earned)).toBe(true);
        }
      }
    }
  });

  it('is reproducible for the same job, sections, checks and snapshot', () => {
    const input = perfectInput();

    expect(score(input)).toEqual(score(input));
  });
});
