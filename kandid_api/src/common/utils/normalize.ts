/**
 * Normaliza texto para comparação de igualdade (ex.: nomes de idiomas e busca
 * no catálogo): trim, lowercase e remoção de acentos.
 * Sinais como `+` em `C++` são preservados.
 */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}
