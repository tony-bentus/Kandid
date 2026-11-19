import type { ExperienceBullet } from '../experiences/entities/experience-bullet.entity.js';
import type { ResumeSnapshot } from '../ats/engine/types.js';
import type { SnapshotSource } from './interfaces/snapshot-source.interface.js';

/** Ordem determinística de ids para desempates estáveis no snapshot. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `YYYY-MM-DD` → `YYYY-MM`, formato de mês usado pelo motor ATS. */
function toMonth(value: string): string {
  return value.slice(0, 7);
}

/**
 * Constrói o snapshot imutável descrito em `docs/prompt-kandid.md:306-357`.
 *
 * A função é pura: o instante `"agora"` é recebido como parâmetro e vira
 * `generatedAt` em ISO 8601 UTC. `seniority` é a extensão provisória do ADR
 * 0005 (decisão 20), copiada de `profile.desired_seniority`; ausente, a chave
 * é omitida do JSON e a dimensão ATS correspondente fica inaplicável.
 */
export function buildResumeSnapshot(
  source: SnapshotSource,
  generatedAt: Date,
): ResumeSnapshot {
  const { profile, user } = source;

  const locationParts = [profile.city, profile.state, profile.country]
    .filter(
      (part): part is string =>
        typeof part === 'string' && part.trim().length > 0,
    )
    .map((part) => part.trim());

  const candidate = {
    name: user.name,
    headline: profile.headline ?? '',
    email: user.email,
    phone: profile.phone ?? '',
    location: locationParts.join(', '),
    links: {
      linkedin: profile.linkedinUrl ?? '',
      github: profile.githubUrl ?? '',
      portfolio: profile.portfolioUrl ?? '',
    },
  };

  const skills = [...source.profileSkills]
    .sort(
      (a, b) =>
        compareIds(a.skill.name, b.skill.name) || compareIds(a.id, b.id),
    )
    .map((link) => ({
      name: link.skill.name,
      category: link.skill.category,
      level: link.level,
      years: link.yearsExperience === null ? null : Number(link.yearsExperience),
    }));

  const bulletsByExperience = new Map<string, ExperienceBullet[]>();
  for (const bullet of source.bullets) {
    const bullets = bulletsByExperience.get(bullet.experienceId) ?? [];
    bullets.push(bullet);
    bulletsByExperience.set(bullet.experienceId, bullets);
  }

  const experiences = [...source.experiences]
    .sort(
      (a, b) =>
        (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1) ||
        (a.startDate === b.startDate ? 0 : a.startDate < b.startDate ? 1 : -1) ||
        a.sortOrder - b.sortOrder ||
        compareIds(a.id, b.id),
    )
    .map((experience) => ({
      company: experience.companyName,
      role: experience.role,
      employmentType: experience.employmentType,
      workModel: experience.workModel,
      location: experience.location,
      startDate: toMonth(experience.startDate),
      endDate: experience.endDate === null ? null : toMonth(experience.endDate),
      current: experience.isCurrent,
      highlights: (bulletsByExperience.get(experience.id) ?? [])
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || compareIds(a.id, b.id),
        )
        .map((bullet) => bullet.text),
    }));

  const education = [...source.education]
    .sort(
      (a, b) =>
        (a.startDate === b.startDate ? 0 : a.startDate < b.startDate ? 1 : -1) ||
        compareIds(a.id, b.id),
    )
    .map((item) => ({
      institution: item.institution,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy,
      startDate: toMonth(item.startDate),
      endDate: item.endDate === null ? null : toMonth(item.endDate),
      current: item.isCurrent,
    }));

  const certifications = [...source.certifications]
    .sort(
      (a, b) =>
        (a.issueDate === b.issueDate ? 0 : a.issueDate < b.issueDate ? 1 : -1) ||
        compareIds(a.id, b.id),
    )
    .map((item) => ({
      name: item.name,
      issuer: item.issuer,
      issueDate: item.issueDate,
      expiryDate: item.expiryDate,
      credentialUrl: item.credentialUrl,
      credentialId: item.credentialId,
    }));

  const languages = [...source.languages]
    .sort((a, b) => compareIds(a.name, b.name) || compareIds(a.id, b.id))
    .map((item) => ({ name: item.name, proficiency: item.proficiency }));

  // Ainda não existe entidade de projeto no domínio: seção obrigatória vazia.
  const projects: never[] = [];

  const snapshot = {
    schemaVersion: '1.0' as const,
    targetRole: source.targetRole,
    generatedAt: generatedAt.toISOString(),
    candidate,
    summary: profile.summary ?? '',
    skills,
    experiences,
    education,
    certifications,
    languages,
    projects,
    seniority: profile.desiredSeniority ?? undefined,
  };

  return snapshot;
}
