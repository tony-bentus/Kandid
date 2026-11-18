/**
 * Converte o `bigint` devolvido pelo MySQL (como string) para número JSON.
 * Valores acima de `Number.MAX_SAFE_INTEGER` não podem ser representados com
 * precisão e são rejeitados. `fieldName` identifica o campo nas mensagens de
 * erro e preserva `desiredSalaryCents` como padrão.
 */
export function bigintCentsToNumber(
  raw: string | null,
  fieldName = 'desiredSalaryCents',
): number | null {
  if (raw === null) {
    return null;
  }

  const cents = BigInt(raw);

  if (cents < 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      `${fieldName} must be between 0 and ${Number.MAX_SAFE_INTEGER}`,
    );
  }

  return Number(cents);
}

/**
 * Converte centavos (inteiro seguro e não negativo) para string, formato
 * aceito pelo driver MySQL para colunas `bigint`. `fieldName` identifica o
 * campo nas mensagens de erro e preserva `desiredSalaryCents` como padrão.
 */
export function numberToBigintCents(
  value: number | null,
  fieldName = 'desiredSalaryCents',
): string | null {
  if (value === null) {
    return null;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative safe integer`);
  }

  return String(value);
}
