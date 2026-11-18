import { QueryFailedError } from 'typeorm';

interface MysqlDriverError {
  code?: unknown;
  sqlMessage?: unknown;
  constraint?: unknown;
}

/**
 * Identifica uma violação de UNIQUE do MySQL (`ER_DUP_ENTRY`) e verifica se a
 * mensagem/constraint menciona o fragmento esperado (por exemplo a tabela ou
 * o índice do vínculo de skill).
 */
export function isDuplicateEntry(
  error: unknown,
  constraintFragment: string,
): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as unknown as
    | MysqlDriverError
    | null
    | undefined;

  if (driverError == null || driverError.code !== 'ER_DUP_ENTRY') {
    return false;
  }

  const details = driverError.sqlMessage ?? driverError.constraint ?? '';

  return String(details as string).includes(constraintFragment);
}
