/**
 * Arredondamento compartilhado pelos indicadores do dashboard.
 *
 * Taxas, percentuais e médias em dias são expostos com duas casas decimais;
 * centavos são expostos como inteiro. Nenhuma função depende de relógio,
 * ambiente ou estado mutável.
 */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundCents(value: number): number {
  return Math.round(value);
}
