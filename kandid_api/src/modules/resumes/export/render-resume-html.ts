import type { ResumeSnapshot } from '../../ats/engine/types.js';
import { escapeHtml } from './escape-html.js';
import { formatSnapshotDate } from './format-date.js';

type SnapshotSkill = ResumeSnapshot['skills'][number];
type SnapshotExperience = ResumeSnapshot['experiences'][number];
type SnapshotEducation = ResumeSnapshot['education'][number];
type SnapshotCertification = ResumeSnapshot['certifications'][number];
type SnapshotLanguage = ResumeSnapshot['languages'][number];

/** Entrada do renderizador: somente o snapshot persistido, sem metadados. */
export interface RenderResumeHtmlInput {
  snapshot: ResumeSnapshot;
}

/**
 * CSS fixo e autocontido: coluna única, legível em tela e em impressão A4.
 * Nada do snapshot entra no CSS; sem fontes externas, grid ou `float`.
 */
const STYLE_LINES = [
  'body { margin: 0; background: #fff; color: #1f2933; font-family: Georgia, "Times New Roman", serif; line-height: 1.5; }',
  'main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }',
  'header { border-bottom: 1px solid #d9e2ec; padding-bottom: 16px; margin-bottom: 24px; }',
  'h1 { font-size: 28px; margin: 0 0 4px; }',
  'h2 { font-size: 18px; margin: 28px 0 8px; }',
  'h3 { font-size: 15px; margin: 0 0 4px; }',
  'p, li { font-size: 14px; }',
  'p { margin: 4px 0; }',
  'ul { margin: 4px 0 0; padding-left: 20px; }',
  'article { margin-bottom: 16px; }',
  '.meta, .contact { font-size: 13px; color: #52606d; }',
  '.contact a { color: inherit; }',
  '@media print { main { max-width: none; padding: 0; } }',
];

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Texto do snapshot já escapado no ponto de emissão. */
function emit(value: string | null | undefined): string {
  return escapeHtml(clean(value));
}

function nonEmpty(values: readonly string[]): string[] {
  return values.filter((value) => value.length > 0);
}

/**
 * Só emite `href` para `http:`/`https:` com host válido. Qualquer outro
 * esquema (inclusive `javascript:` e `data:`) retorna `null` e é omitido.
 */
function httpHref(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (raw.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.host.length === 0
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return escapeHtml(raw);
}

function renderTitle(snapshot: ResumeSnapshot): string {
  const name = clean(snapshot.candidate?.name);
  if (name.length > 0) {
    return `${escapeHtml(name)} — Currículo`;
  }

  const targetRole = clean(snapshot.targetRole);
  if (targetRole.length > 0) {
    return `${escapeHtml(targetRole)} — Currículo`;
  }

  return 'Currículo';
}

function renderHeader(snapshot: ResumeSnapshot): string[] {
  const candidate = snapshot.candidate;
  const name = clean(candidate?.name);
  const targetRole = clean(snapshot.targetRole);
  const headline = clean(candidate?.headline);
  const contact = nonEmpty([
    clean(candidate?.email),
    clean(candidate?.phone),
    clean(candidate?.location),
  ]);

  const links = candidate?.links;
  const contactLinks = nonEmpty([
    httpLink(links?.linkedin, 'LinkedIn'),
    httpLink(links?.github, 'GitHub'),
    httpLink(links?.portfolio, 'Portfólio'),
  ]);

  const heading = name.length > 0 ? name : targetRole;
  const meta = nonEmpty([
    headline.length > 0 && headline !== heading ? headline : '',
    name.length > 0 && headline.length === 0 ? targetRole : '',
  ]);
  const lines: string[] = [];

  if (heading.length > 0) {
    lines.push(`    <h1>${escapeHtml(heading)}</h1>`);
  }
  if (meta.length > 0) {
    lines.push(`    <p class="meta">${meta.map(escapeHtml).join(' · ')}</p>`);
  }
  if (contact.length > 0) {
    lines.push(
      `    <p class="contact">${contact.map(escapeHtml).join(' · ')}</p>`,
    );
  }
  if (contactLinks.length > 0) {
    lines.push(
      `    <p class="contact">${contactLinks.join(' · ')}</p>`,
    );
  }

  return lines;
}

function httpLink(value: string | null | undefined, label: string): string {
  const href = httpHref(value);
  return href === null ? '' : `<a href="${href}">${label}</a>`;
}

function renderSummary(snapshot: ResumeSnapshot): string[] {
  const summary = clean(snapshot.summary);
  return summary.length === 0 ? [] : [`    <p>${escapeHtml(summary)}</p>`];
}

function renderSkill(skill: SnapshotSkill): string[] {
  const years =
    typeof skill.years === 'number' && Number.isFinite(skill.years)
      ? `${skill.years} ${skill.years === 1 ? 'ano' : 'anos'}`
      : '';
  const parts = nonEmpty([
    emit(skill.name),
    emit(skill.category),
    emit(skill.level),
    years,
  ]);

  return parts.length === 0 ? [] : [`      <li>${parts.join(' — ')}</li>`];
}

function renderSkills(snapshot: ResumeSnapshot): string[] {
  const items = snapshot.skills.flatMap(renderSkill);
  return items.length === 0 ? [] : ['    <ul>', ...items, '    </ul>'];
}

/** `Atual` para `current: true` ou quando não há `endDate` informado. */
function period(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  current: boolean | undefined,
): string {
  const start = formatSnapshotDate(startDate);
  const end =
    current === true
      ? 'Atual'
      : (formatSnapshotDate(endDate) ?? (start === null ? null : 'Atual'));

  return [start, end]
    .filter((value): value is string => value !== null)
    .join(' — ');
}

function renderExperience(item: SnapshotExperience): string[] {
  const heading = nonEmpty([emit(item.role), emit(item.company)]).join(' — ');
  const metaParts = nonEmpty([
    period(item.startDate, item.endDate, item.current),
    emit(item.employmentType),
    emit(item.workModel),
    emit(item.location),
  ]);
  const highlights = nonEmpty(
    (item.highlights ?? []).map((highlight) => emit(highlight)),
  );

  const lines: string[] = [];
  if (heading.length > 0) {
    lines.push(`      <h3>${heading}</h3>`);
  }
  if (metaParts.length > 0) {
    lines.push(`      <p class="meta">${metaParts.join(' · ')}</p>`);
  }
  if (highlights.length > 0) {
    lines.push(
      '      <ul>',
      ...highlights.map((highlight) => `        <li>${highlight}</li>`),
      '      </ul>',
    );
  }

  return lines.length === 0 ? [] : ['    <article>', ...lines, '    </article>'];
}

function renderExperiences(snapshot: ResumeSnapshot): string[] {
  return snapshot.experiences.flatMap(renderExperience);
}

function renderEducation(item: SnapshotEducation): string[] {
  const degreeAndField = nonEmpty([
    emit(item.degree),
    emit(item.fieldOfStudy),
  ]).join(' em ');
  const heading = nonEmpty([degreeAndField, emit(item.institution)]).join(
    ' — ',
  );
  const meta = period(item.startDate, item.endDate, item.current);

  const lines: string[] = [];
  if (heading.length > 0) {
    lines.push(`      <h3>${heading}</h3>`);
  }
  if (meta.length > 0) {
    lines.push(`      <p class="meta">${meta}</p>`);
  }

  return lines.length === 0 ? [] : ['    <article>', ...lines, '    </article>'];
}

function renderEducationSection(snapshot: ResumeSnapshot): string[] {
  return snapshot.education.flatMap(renderEducation);
}

function renderCertification(item: SnapshotCertification): string[] {
  const issueDate = formatSnapshotDate(item.issueDate);
  const expiryDate = formatSnapshotDate(item.expiryDate);
  const credentialUrl = httpHref(item.credentialUrl);
  const parts = nonEmpty([
    emit(item.name),
    emit(item.issuer),
    issueDate === null ? '' : `Emitida em ${issueDate}`,
    expiryDate === null ? '' : `Válida até ${expiryDate}`,
    emit(item.credentialId),
    credentialUrl === null
      ? ''
      : `<a href="${credentialUrl}">Ver credencial</a>`,
  ]);

  return parts.length === 0 ? [] : [`      <li>${parts.join(' · ')}</li>`];
}

function renderCertifications(snapshot: ResumeSnapshot): string[] {
  const items = snapshot.certifications.flatMap(renderCertification);
  return items.length === 0 ? [] : ['    <ul>', ...items, '    </ul>'];
}

function renderLanguage(item: SnapshotLanguage): string[] {
  const parts = nonEmpty([emit(item.name), emit(item.proficiency)]);
  return parts.length === 0 ? [] : [`      <li>${parts.join(' — ')}</li>`];
}

function renderLanguages(snapshot: ResumeSnapshot): string[] {
  const items = snapshot.languages.flatMap(renderLanguage);
  return items.length === 0 ? [] : ['    <ul>', ...items, '    </ul>'];
}

function section(title: string, body: readonly string[]): string[] {
  if (body.length === 0) {
    return [];
  }

  return ['  <section>', `    <h2>${title}</h2>`, ...body, '  </section>'];
}

/**
 * Renderizador puro e determinístico do export HTML (KAN-51).
 *
 * Não lê relógio, ambiente, arquivos nem estado mutável; não recebe score,
 * resumeId, versão nem análise. `projects` nunca é renderizado. O mesmo
 * snapshot produz sempre exatamente a mesma string.
 */
export function renderResumeHtml(input: RenderResumeHtmlInput): string {
  const snapshot = input.snapshot;
  const lines: string[] = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${renderTitle(snapshot)}</title>`,
    '<style>',
    ...STYLE_LINES.map((line) => `  ${line}`),
    '</style>',
    '</head>',
    '<body>',
    '<main>',
  ];

  const header = renderHeader(snapshot);
  if (header.length > 0) {
    lines.push('  <header>', ...header, '  </header>');
  }

  lines.push(
    ...section('Resumo', renderSummary(snapshot)),
    ...section('Habilidades', renderSkills(snapshot)),
    ...section('Experiência Profissional', renderExperiences(snapshot)),
    ...section('Formação', renderEducationSection(snapshot)),
    ...section('Certificações', renderCertifications(snapshot)),
    ...section('Idiomas', renderLanguages(snapshot)),
    '  </main>',
    '</body>',
    '</html>',
  );

  return `${lines.join('\n')}\n`;
}
