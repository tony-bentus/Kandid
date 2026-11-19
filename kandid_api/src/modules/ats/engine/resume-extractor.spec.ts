import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { SkillCategory } from '../../../common/enums/skill-category.enum.js';
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { extractResume } from './resume-extractor.js';
import type { ResumeSnapshot, WeightedSection } from './types.js';

type SnapshotExperience = ResumeSnapshot['experiences'][number];

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
  summary: 'Desenvolvedora backend com foco em Node.js e liderança técnica.',
  skills: [
    {
      name: 'Node.js',
      category: SkillCategory.FRAMEWORK,
      level: SkillLevel.ADVANCED,
      years: 5,
    },
    {
      name: 'TypeScript',
      category: SkillCategory.LANGUAGE,
      level: SkillLevel.ADVANCED,
      years: 4,
    },
  ],
  experiences: [makeExperience()],
  education: [],
  certifications: [],
  languages: [{ name: 'Inglês', proficiency: LanguageProficiency.ADVANCED }],
  projects: [],
  seniority: Seniority.SENIOR,
  ...overrides,
});

const textOf = (sections: readonly WeightedSection[]): string =>
  sections.map((section) => section.text).join(' | ');

const sectionsOf = (
  sections: readonly WeightedSection[],
  section: WeightedSection['section'],
): WeightedSection[] => sections.filter((item) => item.section === section);

/**
 * Snapshot com quatro experiências fora de ordem, para provar a ordenação
 * determinística (`current` primeiro, depois `startDate DESC`). A mais antiga
 * e a intermediária devem cair em `otherHighlight` (peso 1).
 */
const orderedSnapshot = (): ResumeSnapshot =>
  makeSnapshot({
    experiences: [
      makeExperience({
        company: 'Old',
        startDate: '2015-01',
        endDate: '2018-12',
        current: false,
        highlights: ['Manteve sistemas legados em Java'],
      }),
      makeExperience({
        company: 'Mid',
        startDate: '2019-01',
        endDate: '2021-12',
        current: false,
        highlights: ['Criou APIs em Node.js'],
      }),
      makeExperience({
        company: 'New',
        startDate: '2024-06',
        endDate: '2025-12',
        current: false,
        highlights: ['Implementou pipeline CI/CD'],
      }),
      makeExperience({
        company: 'Current',
        startDate: '2016-01',
        endDate: null,
        current: true,
        highlights: ['Liderou migração para Kubernetes'],
      }),
    ],
  });

describe('extractResume', () => {
  it('assigns weight 2 to summary and skills, 3/1 to highlights and 1 to projects', () => {
    const sections = extractResume(orderedSnapshot());

    expect(sectionsOf(sections, 'summary')[0]?.weight).toBe(2);
    expect(sectionsOf(sections, 'skills')[0]?.weight).toBe(2);
    expect(
      sections
        .filter((section) => section.section === 'recentHighlight')
        .every((section) => section.weight === 3),
    ).toBe(true);
    expect(
      sections
        .filter((section) => section.section === 'otherHighlight')
        .every((section) => section.weight === 1),
    ).toBe(true);
  });

  it('keeps the summary and skills text available for matching', () => {
    const sections = extractResume(orderedSnapshot());

    expect(sectionsOf(sections, 'summary')[0]?.text).toContain(
      'liderança técnica',
    );
    expect(sectionsOf(sections, 'skills')[0]?.text).toContain('Node.js');
    expect(sectionsOf(sections, 'skills')[0]?.text).toContain('TypeScript');
  });

  it('gives weight 3 to the two most recent experiences', () => {
    const sections = extractResume(orderedSnapshot());
    const recent = sectionsOf(sections, 'recentHighlight');

    expect(recent).not.toHaveLength(0);
    expect(textOf(recent)).toContain('Kubernetes');
    expect(textOf(recent)).toContain('CI/CD');
    expect(textOf(recent)).not.toContain('sistemas legados');
    expect(textOf(recent)).not.toContain('Criou APIs');
  });

  it('gives weight 1 to the remaining highlights', () => {
    const sections = extractResume(orderedSnapshot());
    const other = sectionsOf(sections, 'otherHighlight');

    expect(textOf(other)).toContain('Criou APIs em Node.js');
    expect(textOf(other)).toContain('Manteve sistemas legados em Java');
    expect(textOf(other)).not.toContain('Kubernetes');
    expect(textOf(other)).not.toContain('CI/CD');
  });

  it('places the current experience first even when it is not the newest start date', () => {
    const sections = extractResume(orderedSnapshot());
    const recent = textOf(sectionsOf(sections, 'recentHighlight'));

    // "Current" started in 2016-01, older than "New" (2024-06) and "Mid"
    // (2019-01). `current = true` must win the first slot; sorting only by
    // startDate would have picked "New" and "Mid" instead.
    expect(recent).toContain('Kubernetes');
    expect(recent).toContain('CI/CD');
  });

  it('preserves the snapshot order for ties (sortOrder/id already applied by the builder)', () => {
    const tied = makeSnapshot({
      experiences: [
        makeExperience({
          company: 'A',
          startDate: '2020-01',
          endDate: '2020-12',
          current: false,
          highlights: ['Alpha'],
        }),
        makeExperience({
          company: 'B',
          startDate: '2020-01',
          endDate: '2020-12',
          current: false,
          highlights: ['Beta'],
        }),
        makeExperience({
          company: 'C',
          startDate: '2020-01',
          endDate: '2020-12',
          current: false,
          highlights: ['Gamma'],
        }),
      ],
    });

    const recent = textOf(
      sectionsOf(extractResume(tied), 'recentHighlight'),
    );

    expect(recent).toContain('Alpha');
    expect(recent).toContain('Beta');
    expect(recent).not.toContain('Gamma');
  });

  it('emits each highlight exactly once, never in both weight groups', () => {
    const sections = extractResume(orderedSnapshot());

    for (const keyword of ['Kubernetes', 'CI/CD', 'Criou APIs', 'sistemas legados']) {
      const occurrences = sections.filter((section) =>
        section.text.includes(keyword),
      );

      expect(occurrences).toHaveLength(1);
    }
  });

  it('assigns weight 1 to projects', () => {
    const project = {
      name: 'Kandid API',
      description: 'API REST em Node.js com motor ATS determinístico',
      highlights: ['Score explicável de 0 a 100'],
    } as unknown as ResumeSnapshot['projects'][number];

    const sections = extractResume(makeSnapshot({ projects: [project] }));
    const projectSection = sectionsOf(sections, 'projects')[0];

    expect(projectSection?.weight).toBe(1);
    expect(projectSection?.text).toContain('Kandid');
  });

  it('is deterministic for the same snapshot', () => {
    const snapshot = orderedSnapshot();

    expect(extractResume(snapshot)).toEqual(extractResume(snapshot));
  });
});
