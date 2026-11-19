import { Seniority } from '../../../common/enums/seniority.enum.js';
import { canonicalLanguageKey } from './job-parser.js';
import { containsNormalizedTerm, normalize } from './normalizer.js';
import type {
  AtsScoreResult,
  JobRequirement,
  ResumeSnapshot,
  ScoreDimension,
  ScoreInput,
  SkillMatch,
  StructuralCheck,
} from './types.js';

/**
 * Score explicável do motor ATS (KAN-42).
 *
 * Pesos originais da spec (`docs/prompt-kandid.md:251-263`) e renormalização do
 * ADR 0005: dimensões inaplicáveis ficam fora de `W` e as aplicáveis recebem
 * `effectiveWeight = weight / W`. Função pura: “hoje” é sempre
 * `snapshot.generatedAt`.
 */

const DIMENSION_WEIGHTS = {
  requiredSkills: 35,
  niceToHaveSkills: 10,
  seniority: 20,
  yearsExperience: 15,
  educationCertification: 10,
  languages: 5,
  resumeStructure: 5,
} as const;

type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

/**
 * Peso máximo de uma seção do currículo (highlight de experiência recente).
 *
 * Cada skill pode cobrir no máximo este peso; a cobertura de uma dimensão é a
 * soma dos maiores pesos de seção onde cada requisito aparece dividida por
 * `MAX_SECTION_WEIGHT * total de requisitos`. Assim o peso da seção entra no
 * cálculo, sem somar a mesma keyword em seções diferentes (ADR 0005).
 */
const MAX_SECTION_WEIGHT = 3;

const STRUCTURAL_CHECK_COUNT = 10;

const SENIORITY_ORDER: readonly Seniority[] = [
  Seniority.INTERN,
  Seniority.JUNIOR,
  Seniority.MID,
  Seniority.SENIOR,
  Seniority.LEAD,
  Seniority.STAFF,
  Seniority.PRINCIPAL,
];

interface NormalizedSection {
  weight: number;
  text: string;
}

interface SkillScore {
  dimension: ScoreDimension;
  matched: string[];
  missing: string[];
}

interface YearMonth {
  year: number;
  month: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function inapplicable(
  dimension: DimensionKey,
  detail: string,
): ScoreDimension {
  return {
    dimension,
    weight: DIMENSION_WEIGHTS[dimension],
    effectiveWeight: 0,
    earned: null,
    applicable: false,
    matched: [],
    missing: [],
    detail,
  };
}

function parseYearMonth(value: string | null | undefined): YearMonth | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})/u.exec(value.trim());

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

/** Duração em meses com limites inclusivos; `start > end` contribui com zero. */
function monthsBetweenInclusive(start: YearMonth, end: YearMonth): number {
  const months =
    (end.year - start.year) * 12 + (end.month - start.month) + 1;

  return months > 0 ? months : 0;
}

/**
 * Soma das durações das experiências em meses.
 *
 * `current = true` usa `snapshot.generatedAt` como fim e ignora `endDate`.
 * Experiências sem `startDate` ou sem fim determinável contribuem com zero.
 * Sobreposições são somadas (decisão provisória do ADR 0005).
 */
function totalExperienceMonths(snapshot: ResumeSnapshot): number {
  const reference = parseYearMonth(snapshot.generatedAt);
  let total = 0;

  for (const experience of snapshot.experiences) {
    const start = parseYearMonth(experience.startDate);

    if (start === null) {
      continue;
    }

    const end =
      experience.current === true
        ? reference
        : parseYearMonth(experience.endDate);

    if (end === null) {
      continue;
    }

    total += monthsBetweenInclusive(start, end);
  }

  return total;
}

function formatYears(years: number): string {
  const rounded = Math.round(years * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Maior peso de seção em que a skill aparece. Testa `matchedAs` e `name` para
 * cobrir o alias usado no parsing e o nome canônico do catálogo.
 */
function matchWeight(
  match: SkillMatch,
  sections: readonly NormalizedSection[],
): number {
  const terms = [match.matchedAs, match.name]
    .map((term) => normalize(term))
    .filter((term) => term !== '');

  let best = 0;

  for (const term of terms) {
    for (const section of sections) {
      if (section.weight > best && containsNormalizedTerm(section.text, term)) {
        best = section.weight;
      }
    }
  }

  return best;
}

function scoreSkills(
  dimension: DimensionKey,
  matches: readonly SkillMatch[],
  sections: readonly NormalizedSection[],
  label: string,
): SkillScore {
  if (matches.length === 0) {
    return {
      dimension: inapplicable(
        dimension,
        `nenhuma skill ${label} informada na vaga`,
      ),
      matched: [],
      missing: [],
    };
  }

  let foundWeight = 0;
  let totalWeight = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const match of matches) {
    const requirementWeight = match.weight > 0 ? match.weight : 1;
    totalWeight += MAX_SECTION_WEIGHT * requirementWeight;

    const weight = matchWeight(match, sections);

    if (weight > 0) {
      foundWeight += weight * requirementWeight;
      matched.push(match.name);
    } else {
      missing.push(match.name);
    }
  }

  const earned =
    totalWeight === 0
      ? 0
      : clamp(Math.round((foundWeight / totalWeight) * 100), 0, 100);

  return {
    dimension: {
      dimension,
      weight: DIMENSION_WEIGHTS[dimension],
      effectiveWeight: 0,
      earned,
      applicable: true,
      matched,
      missing,
      detail: `${matched.length} de ${matches.length} skills ${label} encontradas`,
    },
    matched,
    missing,
  };
}

function scoreSeniority(
  job: JobRequirement,
  snapshot: ResumeSnapshot,
): ScoreDimension {
  const required = job.seniorityHint;
  const actual = snapshot.seniority ?? null;

  if (required === null || actual === null) {
    return inapplicable(
      'seniority',
      'senioridade exigida ou do currículo não informada',
    );
  }

  const requiredIndex = SENIORITY_ORDER.indexOf(required);
  const actualIndex = SENIORITY_ORDER.indexOf(actual);

  if (requiredIndex < 0 || actualIndex < 0) {
    return inapplicable('seniority', 'senioridade fora do enum conhecido');
  }

  const difference = Math.abs(requiredIndex - actualIndex);
  const earned = difference === 0 ? 100 : difference === 1 ? 60 : 0;

  return {
    dimension: 'seniority',
    weight: DIMENSION_WEIGHTS.seniority,
    effectiveWeight: 0,
    earned,
    applicable: true,
    matched: difference === 0 ? [actual] : [],
    missing: difference === 0 ? [] : [required],
    detail: `senioridade do currículo ${actual}; exigida ${required}`,
  };
}

function scoreYears(
  job: JobRequirement,
  snapshot: ResumeSnapshot,
): ScoreDimension {
  if (job.yearsRequired === null) {
    return inapplicable(
      'yearsExperience',
      'vaga não informa anos de experiência',
    );
  }

  const actualYears = totalExperienceMonths(snapshot) / 12;
  const earned =
    job.yearsRequired <= 0
      ? 100
      : clamp(Math.round((actualYears / job.yearsRequired) * 100), 0, 100);

  return {
    dimension: 'yearsExperience',
    weight: DIMENSION_WEIGHTS.yearsExperience,
    effectiveWeight: 0,
    earned,
    applicable: true,
    matched: [],
    missing: [],
    detail: `${formatYears(actualYears)} de ${job.yearsRequired} anos exigidos`,
  };
}

function hasEducation(snapshot: ResumeSnapshot): boolean {
  return snapshot.education.some(
    (education) =>
      !isBlank(education.institution) ||
      !isBlank(education.degree) ||
      !isBlank(education.fieldOfStudy),
  );
}

function hasCertification(snapshot: ResumeSnapshot): boolean {
  return snapshot.certifications.some(
    (certification) => !isBlank(certification.name),
  );
}

function scoreEducationCertification(
  job: JobRequirement,
  snapshot: ResumeSnapshot,
): ScoreDimension {
  if (!job.educationRequired && !job.certificationRequired) {
    return inapplicable(
      'educationCertification',
      'vaga não exige formação nem certificação',
    );
  }

  const educationMissing = job.educationRequired && !hasEducation(snapshot);
  const certificationMissing =
    job.certificationRequired && !hasCertification(snapshot);
  const missing: string[] = [];

  if (educationMissing) {
    missing.push('formação');
  }

  if (certificationMissing) {
    missing.push('certificação');
  }

  return {
    dimension: 'educationCertification',
    weight: DIMENSION_WEIGHTS.educationCertification,
    effectiveWeight: 0,
    earned: missing.length === 0 ? 100 : 0,
    applicable: true,
    matched: [],
    missing,
    detail:
      missing.length === 0
        ? 'requisitos de formação/certificação atendidos'
        : `requisitos não atendidos: ${missing.join(' e ')}`,
  };
}

function scoreLanguages(
  job: JobRequirement,
  snapshot: ResumeSnapshot,
): ScoreDimension {
  if (job.languagesRequired.length === 0) {
    return inapplicable('languages', 'vaga não exige idiomas');
  }

  const available = new Set(
    snapshot.languages
      .map((language) => canonicalLanguageKey(language.name ?? ''))
      .filter((key) => key !== ''),
  );

  const matched: string[] = [];
  const missing: string[] = [];

  for (const required of job.languagesRequired) {
    if (available.has(canonicalLanguageKey(required))) {
      matched.push(required);
    } else {
      missing.push(required);
    }
  }

  return {
    dimension: 'languages',
    weight: DIMENSION_WEIGHTS.languages,
    effectiveWeight: 0,
    earned: missing.length === 0 ? 100 : 0,
    applicable: true,
    matched,
    missing,
    detail:
      missing.length === 0
        ? 'todos os idiomas exigidos encontrados'
        : `idiomas ausentes: ${missing.join(', ')}`,
  };
}

function scoreStructure(
  checks: readonly StructuralCheck[],
): ScoreDimension {
  const matched = checks
    .filter((check) => check.passed)
    .map((check) => check.id);
  const missing = checks
    .filter((check) => !check.passed)
    .map((check) => check.id);
  const earned = clamp(
    Math.round((matched.length / STRUCTURAL_CHECK_COUNT) * 100),
    0,
    100,
  );

  return {
    dimension: 'resumeStructure',
    weight: DIMENSION_WEIGHTS.resumeStructure,
    effectiveWeight: 0,
    earned,
    applicable: true,
    matched,
    missing,
    detail: `${matched.length} de ${STRUCTURAL_CHECK_COUNT} checks estruturais aprovados`,
  };
}

/** Deduplica por texto normalizado preservando a primeira grafia. */
function dedupeNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const key = normalize(name);

    if (key === '' || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(name);
  }

  return result;
}

export function score(input: ScoreInput): AtsScoreResult {
  const { job, sections, checks, snapshot } = input;

  const normalizedSections: NormalizedSection[] = sections
    .map((section) => ({
      weight: section.weight,
      text: normalize(section.text),
    }))
    .filter((section) => section.text !== '');

  const required = scoreSkills(
    'requiredSkills',
    job.required,
    normalizedSections,
    'obrigatórias',
  );
  const niceToHave = scoreSkills(
    'niceToHaveSkills',
    job.niceToHave,
    normalizedSections,
    'desejáveis',
  );

  const breakdown: ScoreDimension[] = [
    required.dimension,
    niceToHave.dimension,
    scoreSeniority(job, snapshot),
    scoreYears(job, snapshot),
    scoreEducationCertification(job, snapshot),
    scoreLanguages(job, snapshot),
    scoreStructure(checks),
  ];

  const totalWeight = breakdown
    .filter((dimension) => dimension.applicable)
    .reduce((sum, dimension) => sum + dimension.weight, 0);

  for (const dimension of breakdown) {
    dimension.effectiveWeight =
      dimension.applicable && totalWeight > 0
        ? dimension.weight / totalWeight
        : 0;
  }

  const rawScore = breakdown.reduce(
    (sum, dimension) =>
      sum + (dimension.earned ?? 0) * dimension.effectiveWeight,
    0,
  );

  return {
    score: clamp(Math.round(rawScore), 0, 100),
    breakdown,
    matchedKeywords: dedupeNames([
      ...required.matched,
      ...niceToHave.matched,
    ]),
    missingKeywords: dedupeNames(required.missing),
  };
}
