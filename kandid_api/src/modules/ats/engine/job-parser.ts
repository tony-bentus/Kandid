import { Seniority } from '../../../common/enums/seniority.enum.js';
import {
  containsNormalizedTerm,
  indexOfNormalizedTerm,
  normalize,
} from './normalizer.js';
import type {
  JobRequirement,
  ParseJobInput,
  SkillCatalogEntry,
  SkillMatch,
} from './types.js';

/**
 * Parser determinístico da descrição da vaga (KAN-41).
 *
 * A descrição é quebrada em linhas e blocos por títulos reconhecidos. Se nenhum
 * título for encontrado, todos os matches entram em `required`. Não há I/O,
 * relógio de parede nem aleatoriedade.
 */

type SectionKind = 'required' | 'niceToHave';

interface ParsedBlock {
  kind: SectionKind | 'unclassified';
  text: string;
}

interface SectionHeader {
  kind: SectionKind;
  remainder: string;
}

/**
 * Títulos aceitos, já normalizados (lowercase e sem acentos). Formas plurais e
 * a variante com hífen são aceitas para reduzir falsos negativos.
 */
const REQUIRED_HEADERS: readonly string[] = [
  'requisitos',
  'requisito',
  'requirements',
  'requirement',
  'must have',
  'must-have',
  'obrigatorios',
  'obrigatorio',
  'necessarios',
  'necessario',
];

const NICE_TO_HAVE_HEADERS: readonly string[] = [
  'diferenciais',
  'diferencial',
  'nice to have',
  'nice-to-have',
  'desejaveis',
  'desejavel',
  'plus',
  'preferenciais',
  'preferencial',
];

/**
 * Remove decorações comuns de markdown/bullet antes de reconhecer um título.
 * Não é aplicado ao conteúdo: apenas ao teste de cabeçalho.
 */
function stripHeaderDecorations(line: string): string {
  return line
    .replace(/^[\s#>*•·\-–—]+/u, '')
    .replace(/[*_`~]+$/u, '')
    .trim();
}

/**
 * Reconhece um título de seção no início da linha.
 *
 * Retorna `null` quando a linha não é um título. Quando é, devolve o tipo da
 * seção e o conteúdo que veio na mesma linha (ex.: `Requisitos: Node.js`).
 */
function detectSectionHeader(line: string): SectionHeader | null {
  const cleaned = stripHeaderDecorations(line);

  for (const header of REQUIRED_HEADERS) {
    const remainder = matchHeader(cleaned, header);
    if (remainder !== null) {
      return { kind: 'required', remainder };
    }
  }

  for (const header of NICE_TO_HAVE_HEADERS) {
    const remainder = matchHeader(cleaned, header);
    if (remainder !== null) {
      return { kind: 'niceToHave', remainder };
    }
  }

  return null;
}

/**
 * `line` deve começar com `header` e ser exatamente o título ou trazê-lo
 * seguido de `:`, `-`, `–` ou `—`. Evita reconhecer "plus" no meio de uma
 * frase comum.
 */
function matchHeader(line: string, header: string): string | null {
  if (line === header) {
    return '';
  }

  if (!line.startsWith(header)) {
    return null;
  }

  const rest = line.slice(header.length);
  const separator = /^\s*[:\-–—]\s*(.*)$/u.exec(rest);

  if (separator === null) {
    return null;
  }

  return separator[1].trim();
}

/**
 * Compara a descrição normalizada contra `skill.name` + aliases.
 *
 * Os candidatos são ordenados por tamanho decrescente (desempate pela ordem
 * original) para que aliases longos vençam matches parciais. A saída preserva
 * a ordem do catálogo e é deduplicada por `skillId` no chamador.
 */
function matchSkills(
  text: string,
  skills: readonly SkillCatalogEntry[],
): SkillMatch[] {
  const matches: SkillMatch[] = [];

  for (const skill of skills) {
    const match = matchSkill(text, skill);
    if (match !== null) {
      matches.push(match);
    }
  }

  return matches;
}

function matchSkill(text: string, skill: SkillCatalogEntry): SkillMatch | null {
  const candidates = [
    { term: skill.name, normalized: normalize(skill.name), index: 0 },
    ...skill.aliases.map((alias, index) => ({
      term: alias,
      normalized: normalize(alias),
      index: index + 1,
    })),
  ]
    .filter((candidate) => candidate.normalized !== '')
    .sort(
      (a, b) =>
        b.normalized.length - a.normalized.length || a.index - b.index,
    );

  for (const candidate of candidates) {
    if (containsNormalizedTerm(text, candidate.normalized)) {
      return {
        skillId: skill.id,
        name: skill.name,
        matchedAs: candidate.term,
        weight: 1,
      };
    }
  }

  return null;
}

const YEARS_PATTERN = /\b(\d+)\s*\+?\s*(?:anos|years)\b/gu;

/**
 * Extrai anos exigidos com `(\d+)\s*\+?\s*(anos|years)`.
 *
 * Havendo mais de um número, usa o **maior** (decisão provisória do ADR 0005).
 */
function extractYears(description: string): number | null {
  const values: number[] = [];

  for (const match of description.matchAll(YEARS_PATTERN)) {
    values.push(Number(match[1]));
  }

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

/**
 * Dicionário provisório de senioridade (PT/EN), avaliado na ordem
 * `INTERN..PRINCIPAL`. O primeiro nível encontrado vence.
 */
const SENIORITY_DICTIONARY: ReadonlyArray<{
  seniority: Seniority;
  terms: readonly string[];
}> = [
  { seniority: Seniority.INTERN, terms: ['intern', 'estagio', 'estagiario'] },
  { seniority: Seniority.JUNIOR, terms: ['junior'] },
  { seniority: Seniority.MID, terms: ['mid', 'pleno'] },
  { seniority: Seniority.SENIOR, terms: ['senior'] },
  { seniority: Seniority.LEAD, terms: ['lead', 'lider'] },
  { seniority: Seniority.STAFF, terms: ['staff'] },
  { seniority: Seniority.PRINCIPAL, terms: ['principal'] },
];

function extractSeniority(description: string): Seniority | null {
  for (const entry of SENIORITY_DICTIONARY) {
    if (entry.terms.some((term) => containsNormalizedTerm(description, term))) {
      return entry.seniority;
    }
  }

  return null;
}

/**
 * Dicionário provisório de formação (PT/EN). A spec não define o vocabulário;
 * este conjunto é determinístico e sujeito ao portão humano (ADR 0005).
 * "master" isolado foi omitido para não confundir "Scrum Master" com formação;
 * "degree" cobre "master's degree".
 */
const EDUCATION_TERMS: readonly string[] = [
  'formacao',
  'graduacao',
  'graduado',
  'bacharel',
  'bacharelado',
  'licenciatura',
  'mestrado',
  'doutorado',
  'pos-graduacao',
  'diploma',
  'degree',
  'bachelor',
  'phd',
  'doctorate',
  'education',
  'universidade',
  'faculdade',
  'ensino superior',
];

/** Dicionário provisório de certificação (PT/EN), sujeito ao portão humano. */
const CERTIFICATION_TERMS: readonly string[] = [
  'certificacao',
  'certificacoes',
  'certificado',
  'certificados',
  'certification',
  'certifications',
  'certified',
  'certificate',
  'pmp',
];

function detectAnyTerm(
  description: string,
  terms: readonly string[],
): boolean {
  return terms.some((term) => containsNormalizedTerm(description, term));
}

interface LanguageGroup {
  name: string;
  terms: readonly string[];
}

/**
 * Dicionário provisório de idiomas (PT/EN). Cada grupo aponta para um nome
 * canônico usado em `languagesRequired` e na comparação com o snapshot.
 */
const LANGUAGE_GROUPS: readonly LanguageGroup[] = [
  { name: 'Inglês', terms: ['ingles', 'english'] },
  { name: 'Português', terms: ['portugues', 'portuguese'] },
  { name: 'Espanhol', terms: ['espanhol', 'spanish', 'castellano'] },
  { name: 'Francês', terms: ['frances', 'french', 'francais'] },
  { name: 'Alemão', terms: ['alemao', 'german', 'deutsch'] },
  { name: 'Italiano', terms: ['italiano', 'italian'] },
  { name: 'Mandarim', terms: ['mandarim', 'mandarin'] },
  { name: 'Japonês', terms: ['japones', 'japanese'] },
  { name: 'Coreano', terms: ['coreano', 'korean'] },
  { name: 'Holandês', terms: ['holandes', 'dutch'] },
  { name: 'Russo', terms: ['russo', 'russian'] },
  { name: 'Árabe', terms: ['arabe', 'arabic'] },
  { name: 'Hindi', terms: ['hindi'] },
];

function extractLanguages(description: string): string[] {
  const found: Array<{ name: string; index: number }> = [];

  for (const group of LANGUAGE_GROUPS) {
    let firstIndex = -1;

    for (const term of group.terms) {
      const index = indexOfNormalizedTerm(description, term);
      if (index >= 0 && (firstIndex === -1 || index < firstIndex)) {
        firstIndex = index;
      }
    }

    if (firstIndex >= 0) {
      found.push({ name: group.name, index: firstIndex });
    }
  }

  found.sort((a, b) => {
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return found.map((entry) => entry.name);
}

/**
 * Converte um nome de idioma (PT/EN) no nome canônico do dicionário.
 *
 * Usado pelo scorer para comparar `languagesRequired` com `snapshot.languages`.
 * Nomes desconhecidos voltam normalizados, garantindo comparação determinística.
 */
export function canonicalLanguageKey(value: string): string {
  const normalized = normalize(value);

  for (const group of LANGUAGE_GROUPS) {
    if (group.terms.some((term) => containsNormalizedTerm(normalized, term))) {
      return group.name;
    }
  }

  return normalized;
}

/**
 * Extrai requisitos da vaga a partir do texto livre e do catálogo de skills.
 *
 * Regras:
 * - títulos obrigatórios e desejáveis são reconhecidos por linha;
 * - sem títulos, tudo é `required`;
 * - dedup por `skillId` (obrigatória vence a desejável);
 * - `yearsRequired` usa o maior número encontrado;
 * - detectores de formação/certificação/idiomas são provisórios e
 *   determinísticos (ADR 0005).
 */
export function parseJob(input: ParseJobInput): JobRequirement {
  const normalizedLines = input.description
    .split(/\r?\n/u)
    .map((line) => normalize(line));
  const normalizedDescription = normalizedLines
    .filter((line) => line !== '')
    .join(' ');

  const blocks: ParsedBlock[] = [];
  let currentKind: ParsedBlock['kind'] = 'unclassified';
  let currentLines: string[] = [];

  const flush = (): void => {
    if (currentLines.length > 0) {
      blocks.push({ kind: currentKind, text: currentLines.join(' ') });
      currentLines = [];
    }
  };

  for (const line of normalizedLines) {
    if (line === '') {
      continue;
    }

    const header = detectSectionHeader(line);

    if (header !== null) {
      flush();
      currentKind = header.kind;
      if (header.remainder !== '') {
        currentLines.push(header.remainder);
      }
      continue;
    }

    currentLines.push(line);
  }

  flush();

  const required = new Map<string, SkillMatch>();
  const niceToHave = new Map<string, SkillMatch>();

  for (const block of blocks) {
    for (const match of matchSkills(block.text, input.skills)) {
      if (block.kind === 'niceToHave') {
        if (!required.has(match.skillId) && !niceToHave.has(match.skillId)) {
          niceToHave.set(match.skillId, match);
        }
        continue;
      }

      if (!required.has(match.skillId)) {
        required.set(match.skillId, match);
      }
      niceToHave.delete(match.skillId);
    }
  }

  return {
    required: [...required.values()],
    niceToHave: [...niceToHave.values()],
    yearsRequired: extractYears(normalizedDescription),
    seniorityHint: extractSeniority(normalizedDescription),
    educationRequired: detectAnyTerm(normalizedDescription, EDUCATION_TERMS),
    certificationRequired: detectAnyTerm(
      normalizedDescription,
      CERTIFICATION_TERMS,
    ),
    languagesRequired: extractLanguages(normalizedDescription),
  };
}
