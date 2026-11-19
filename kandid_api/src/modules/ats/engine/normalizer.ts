/**
 * Normalização canônica do motor ATS.
 *
 * A mesma função é aplicada à descrição da vaga, aos nomes/aliases do catálogo
 * de skills e ao texto extraído do snapshot. Isso garante comparação simétrica
 * e determinística entre as três fontes.
 *
 * Ordem (ADR 0005 §Motor ATS):
 * 1. lowercase;
 * 2. remoção de acentos (NFD + marcas diacríticas);
 * 3. colapso de espaços;
 * 4. canonicalização de símbolos antes de tokenizar;
 * 5. preservação de dígitos (anos de experiência).
 */

/**
 * Canonicalizações aplicadas depois do lowercase e da remoção de acentos.
 * A ordem importa apenas para evitar que uma regra consuma o padrão de outra.
 */
const SYMBOL_CANONICALIZATION: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bc\+\+/gu, 'cpp'],
  [/\bc#/gu, 'csharp'],
  [/\.net\b/gu, 'dotnet'],
  [/\bnode\.js\b/gu, 'nodejs'],
  [/\bci\/cd\b/gu, 'cicd'],
];

/**
 * Normaliza texto livre para comparação de termos.
 *
 * Dígitos são preservados para a extração de anos (`5+ anos`, `3 years`).
 */
export function normalize(input: string): string {
  const folded = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  return SYMBOL_CANONICALIZATION.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    folded,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Índice da primeira ocorrência de `term` como token isolado em `haystack`.
 *
 * Ambos os argumentos devem estar previamente normalizados. Os limites usam
 * `[a-z0-9]` porque `normalize` remove acentos e canonicaliza os símbolos
 * relevantes (`c++`, `c#`, `.net`, `node.js`, `ci/cd`). Retorna `-1` quando o
 * termo não aparece.
 */
export function indexOfNormalizedTerm(haystack: string, term: string): number {
  if (term.length === 0) {
    return -1;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(term)}(?=[^a-z0-9]|$)`,
    'u',
  );
  const match = pattern.exec(haystack);

  if (match === null) {
    return -1;
  }

  return match.index + match[1].length;
}

/**
 * `true` quando `term` aparece como token isolado em `haystack`.
 *
 * Ambos os argumentos devem estar previamente normalizados.
 */
export function containsNormalizedTerm(
  haystack: string,
  term: string,
): boolean {
  return indexOfNormalizedTerm(haystack, term) >= 0;
}
