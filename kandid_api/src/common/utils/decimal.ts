/**
 * Converte o `decimal(4,1)` devolvido pelo MySQL como string para número JSON.
 */
export function decimalToNumber(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new RangeError('yearsExperience must be a finite number');
  }

  return value;
}

/**
 * Formata anos de experiência para `decimal(4,1)` (0 a 99.9, uma casa decimal).
 */
export function numberToDecimal(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value >= 1000 ||
    Number(value.toFixed(1)) !== value
  ) {
    throw new RangeError(
      'yearsExperience must have at most one decimal place and be between 0 and 99.9',
    );
  }

  return value.toFixed(1);
}
