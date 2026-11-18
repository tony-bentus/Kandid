import { BadRequestException } from '@nestjs/common';

/**
 * Converte uma data `YYYY-MM-DD` para milissegundos UTC, sem fuso local.
 * A validação de formato e existência da data é feita pelos DTOs.
 */
export function dateOnlyToUtcMs(value: string): number {
  const [year, month, day] = value.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}

/**
 * Garante que a data final não seja anterior à data inicial informada.
 * `startField`/`endField` aparecem na mensagem para indicar os campos do domínio
 * que foram violados (por exemplo `issueDate`/`expiryDate` em certificações).
 */
export function assertDateOrder(
  startDate: string,
  endDate: string | null,
  startField: string,
  endField = 'endDate',
): void {
  if (endDate !== null && dateOnlyToUtcMs(endDate) < dateOnlyToUtcMs(startDate)) {
    throw new BadRequestException(
      `${endField} must be greater than or equal to ${startField}`,
    );
  }
}
