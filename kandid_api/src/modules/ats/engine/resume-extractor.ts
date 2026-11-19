import type {
  ResumeExperience,
  ResumeSnapshot,
  WeightedSection,
} from './types.js';

/**
 * Extração do currículo em seções ponderadas (KAN-42).
 *
 * Pesos exatos da spec (`docs/prompt-kandid.md:235-245`):
 * - `summary` = 2;
 * - highlights das 2 experiências mais recentes = 3;
 * - demais highlights = 1;
 * - `skills` = 2;
 * - `projects` = 1.
 *
 * O texto é preservado como veio do snapshot; o scorer aplica `normalize`
 * antes de comparar. Função pura: sem I/O, banco ou relógio.
 */

const RECENT_EXPERIENCE_COUNT = 2;
const SUMMARY_WEIGHT = 2;
const RECENT_HIGHLIGHT_WEIGHT = 3;
const OTHER_HIGHLIGHT_WEIGHT = 1;
const SKILLS_WEIGHT = 2;
const PROJECTS_WEIGHT = 1;
const MISSING_SORT_ORDER = Number.MAX_SAFE_INTEGER;

interface RankedExperience {
  experience: ResumeExperience;
  originalIndex: number;
}

/**
 * Ordem determinística: `current` primeiro; depois `startDate` DESC; depois
 * `sortOrder` ASC; depois `id` ASC. O índice original é o desempate final para
 * snapshots sem `id`/`sortOrder`, preservando determinismo.
 */
function compareExperiences(a: RankedExperience, b: RankedExperience): number {
  const aCurrent = a.experience.current === true ? 1 : 0;
  const bCurrent = b.experience.current === true ? 1 : 0;

  if (aCurrent !== bCurrent) {
    return bCurrent - aCurrent;
  }

  const aStart = (a.experience.startDate ?? '').trim();
  const bStart = (b.experience.startDate ?? '').trim();

  if (aStart !== bStart) {
    return aStart < bStart ? 1 : -1;
  }

  const aSortOrder = a.experience.sortOrder ?? MISSING_SORT_ORDER;
  const bSortOrder = b.experience.sortOrder ?? MISSING_SORT_ORDER;

  if (aSortOrder !== bSortOrder) {
    return aSortOrder - bSortOrder;
  }

  const aId = a.experience.id ?? '';
  const bId = b.experience.id ?? '';

  if (aId !== bId) {
    return aId < bId ? -1 : 1;
  }

  return a.originalIndex - b.originalIndex;
}

function nonEmptyHighlights(experience: ResumeExperience): string[] {
  return (experience.highlights ?? [])
    .map((highlight) => highlight.trim())
    .filter((highlight) => highlight !== '');
}

function projectText(project: {
  name?: string | null;
  description?: string | null;
}): string {
  return [project.name, project.description]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim() !== '',
    )
    .map((value) => value.trim())
    .join(' — ');
}

/**
 * Converte o snapshot em seções ponderadas, na ordem estável:
 * resumo, highlights (experiência mais recente primeiro), skills, projects.
 */
export function extractResume(snapshot: ResumeSnapshot): WeightedSection[] {
  const sections: WeightedSection[] = [];

  const summary = (snapshot.summary ?? '').trim();
  if (summary !== '') {
    sections.push({ section: 'summary', weight: SUMMARY_WEIGHT, text: summary });
  }

  const ranked = snapshot.experiences
    .map((experience, originalIndex) => ({ experience, originalIndex }))
    .sort(compareExperiences);

  ranked.forEach(({ experience }, rank) => {
    const highlights = nonEmptyHighlights(experience);

    if (highlights.length === 0) {
      return;
    }

    const isRecent = rank < RECENT_EXPERIENCE_COUNT;

    sections.push({
      section: isRecent ? 'recentHighlight' : 'otherHighlight',
      weight: isRecent ? RECENT_HIGHLIGHT_WEIGHT : OTHER_HIGHLIGHT_WEIGHT,
      text: highlights.join('\n'),
    });
  });

  const skillNames = snapshot.skills
    .map((skill) => skill.name.trim())
    .filter((name) => name !== '');

  if (skillNames.length > 0) {
    sections.push({
      section: 'skills',
      weight: SKILLS_WEIGHT,
      text: skillNames.join(', '),
    });
  }

  const projectTexts = snapshot.projects
    .map((project) => projectText(project))
    .filter((text) => text !== '');

  if (projectTexts.length > 0) {
    sections.push({
      section: 'projects',
      weight: PROJECTS_WEIGHT,
      text: projectTexts.join('\n'),
    });
  }

  return sections;
}
