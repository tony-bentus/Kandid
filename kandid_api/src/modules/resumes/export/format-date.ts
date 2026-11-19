const YEAR_MONTH = /^(\d{4})-(\d{2})$/;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidMonth(value: string): boolean {
  const month = Number(value);
  return month >= 1 && month <= 12;
}

function isValidDay(value: string): boolean {
  const day = Number(value);
  return day >= 1 && day <= 31;
}

/**
 * Converte datas do snapshot para exibição, sem relógio, locale ou `Date`.
 *
 * - `YYYY-MM` → `MM/YYYY`
 * - `YYYY-MM-DD` → `DD/MM/YYYY`
 *
 * Valor ausente, vazio, com outro formato ou com mês/dia fora da faixa retorna
 * `null`; o chamador simplesmente omite o trecho, sem quebrar a renderização.
 */
export function formatSnapshotDate(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const full = YEAR_MONTH_DAY.exec(value);
  if (full !== null && isValidMonth(full[2]) && isValidDay(full[3])) {
    return `${full[3]}/${full[2]}/${full[1]}`;
  }

  const month = YEAR_MONTH.exec(value);
  if (month !== null && isValidMonth(month[2])) {
    return `${month[2]}/${month[1]}`;
  }

  return null;
}
