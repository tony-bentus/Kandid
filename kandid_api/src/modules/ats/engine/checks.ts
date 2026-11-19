import { normalize } from './normalizer.js';
import type { ResumeSnapshot, StructuralCheck } from './types.js';

/**
 * Checks estruturais do snapshot (KAN-42).
 *
 * Avalia o snapshot, nunca o HTML. A ordem e os IDs são exatamente os do
 * ADR 0005 §Motor ATS. `detail` é `null` quando o check passa e uma explicação
 * curta quando falha. Função pura: sem I/O, banco ou relógio.
 */

const MAX_BULLET_LENGTH = 220;

interface YearMonth {
  year: number;
  month: number;
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim() === '';
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

function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }

  return a.month - b.month;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function hasSummary(snapshot: ResumeSnapshot): StructuralCheck {
  const passed = !isBlank(snapshot.summary);

  return {
    id: 'has-summary',
    passed,
    detail: passed ? null : 'resumo ausente ou vazio',
  };
}

function hasContact(snapshot: ResumeSnapshot): StructuralCheck {
  const hasEmail = !isBlank(snapshot.candidate.email);
  const hasPhone = !isBlank(snapshot.candidate.phone);

  if (hasEmail && hasPhone) {
    return { id: 'has-contact', passed: true, detail: null };
  }

  const missing: string[] = [];
  if (!hasEmail) {
    missing.push('e-mail');
  }
  if (!hasPhone) {
    missing.push('telefone');
  }

  return {
    id: 'has-contact',
    passed: false,
    detail: `contato incompleto: ${missing.join(' e ')} ausente(s)`,
  };
}

function hasExperience(snapshot: ResumeSnapshot): StructuralCheck {
  const passed = snapshot.experiences.length > 0;

  return {
    id: 'has-experience',
    passed,
    detail: passed ? null : 'nenhuma experiência cadastrada',
  };
}

function hasHighlights(snapshot: ResumeSnapshot): StructuralCheck {
  const passed = snapshot.experiences.some((experience) =>
    (experience.highlights ?? []).some((highlight) => !isBlank(highlight)),
  );

  return {
    id: 'has-highlights',
    passed,
    detail: passed ? null : 'nenhum highlight de experiência encontrado',
  };
}

function datesConsistent(snapshot: ResumeSnapshot): StructuralCheck {
  let missingStartDate = 0;
  let currentWithEndDate = 0;
  let invertedRange = 0;

  for (const experience of snapshot.experiences) {
    const start = parseYearMonth(experience.startDate);
    const end = parseYearMonth(experience.endDate);

    if (start === null) {
      missingStartDate += 1;
    }

    if (experience.current === true && !isBlank(experience.endDate)) {
      currentWithEndDate += 1;
    }

    if (start !== null && end !== null && compareYearMonth(start, end) > 0) {
      invertedRange += 1;
    }
  }

  const problems: string[] = [];

  if (missingStartDate > 0) {
    problems.push(
      plural(
        missingStartDate,
        'experiência sem startDate',
        'experiências sem startDate',
      ),
    );
  }

  if (currentWithEndDate > 0) {
    problems.push(
      plural(
        currentWithEndDate,
        'experiência current com endDate',
        'experiências current com endDate',
      ),
    );
  }

  if (invertedRange > 0) {
    problems.push(
      plural(
        invertedRange,
        'experiência com startDate após endDate',
        'experiências com startDate após endDate',
      ),
    );
  }

  const passed = problems.length === 0;

  return {
    id: 'dates-consistent',
    passed,
    detail: passed ? null : problems.join('; '),
  };
}

/**
 * Considera "seção obrigatória vazia" a seção que contém ao menos uma entrada
 * sem nenhum conteúdo significativo. Arrays vazios (`certifications: []`,
 * `projects: []`) não falham: o snapshot canônico da spec os admite vazios.
 */
function noEmptyRequiredSections(snapshot: ResumeSnapshot): StructuralCheck {
  const emptySections: string[] = [];

  if (snapshot.skills.some((skill) => isBlank(skill.name))) {
    emptySections.push('skills');
  }

  const hasEmptyExperience = snapshot.experiences.some(
    (experience) =>
      isBlank(experience.company) &&
      isBlank(experience.role) &&
      (experience.highlights ?? []).every((highlight) => isBlank(highlight)),
  );

  if (hasEmptyExperience) {
    emptySections.push('experiences');
  }

  const hasEmptyEducation = snapshot.education.some(
    (education) =>
      isBlank(education.institution) &&
      isBlank(education.degree) &&
      isBlank(education.fieldOfStudy),
  );

  if (hasEmptyEducation) {
    emptySections.push('education');
  }

  if (snapshot.certifications.some((certification) => isBlank(certification.name))) {
    emptySections.push('certifications');
  }

  if (
    snapshot.projects.some(
      (project) => isBlank(project.name) && isBlank(project.description),
    )
  ) {
    emptySections.push('projects');
  }

  if (snapshot.languages.some((language) => isBlank(language.name))) {
    emptySections.push('languages');
  }

  const passed = emptySections.length === 0;

  return {
    id: 'no-empty-required-sections',
    passed,
    detail: passed
      ? null
      : `seções com entradas vazias: ${emptySections.join(', ')}`,
  };
}

function bulletLength(snapshot: ResumeSnapshot): StructuralCheck {
  let overLimit = 0;

  for (const experience of snapshot.experiences) {
    for (const highlight of experience.highlights ?? []) {
      if (highlight.trim().length > MAX_BULLET_LENGTH) {
        overLimit += 1;
      }
    }
  }

  const passed = overLimit === 0;

  return {
    id: 'bullet-length',
    passed,
    detail: passed
      ? null
      : `${plural(overLimit, 'bullet acima de', 'bullets acima de')} ${MAX_BULLET_LENGTH} caracteres`,
  };
}

function hasSkills(snapshot: ResumeSnapshot): StructuralCheck {
  const passed = snapshot.skills.some((skill) => !isBlank(skill.name));

  return {
    id: 'has-skills',
    passed,
    detail: passed ? null : 'nenhuma habilidade cadastrada',
  };
}

function targetRoleDefined(snapshot: ResumeSnapshot): StructuralCheck {
  const passed = !isBlank(snapshot.targetRole);

  return {
    id: 'target-role-defined',
    passed,
    detail: passed ? null : 'cargo-alvo não definido',
  };
}

function noDuplicateSkills(snapshot: ResumeSnapshot): StructuralCheck {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const skill of snapshot.skills) {
    const key = normalize(skill.name);

    if (key === '') {
      continue;
    }

    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  const passed = duplicates === 0;

  return {
    id: 'no-duplicate-skills',
    passed,
    detail: passed
      ? null
      : plural(duplicates, 'habilidade duplicada', 'habilidades duplicadas'),
  };
}

/**
 * Executa os 10 checks estruturais, exatamente nesta ordem:
 * `has-summary`, `has-contact`, `has-experience`, `has-highlights`,
 * `dates-consistent`, `no-empty-required-sections`, `bullet-length`,
 * `has-skills`, `target-role-defined`, `no-duplicate-skills`.
 */
export function runChecks(snapshot: ResumeSnapshot): StructuralCheck[] {
  return [
    hasSummary(snapshot),
    hasContact(snapshot),
    hasExperience(snapshot),
    hasHighlights(snapshot),
    datesConsistent(snapshot),
    noEmptyRequiredSections(snapshot),
    bulletLength(snapshot),
    hasSkills(snapshot),
    targetRoleDefined(snapshot),
    noDuplicateSkills(snapshot),
  ];
}
