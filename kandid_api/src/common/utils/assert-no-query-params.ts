import { BadRequestException } from '@nestjs/common';

/**
 * Rotas sem filtro, paginação ou período não aceitam nenhum query parameter.
 * Validação explícita para produzir a mensagem do contrato; como o parâmetro
 * não é decorado com `@Query()`, o ValidationPipe global não intervém.
 */
export function assertNoQueryParams(query: Record<string, unknown>): void {
  const keys = Object.keys(query);

  if (keys.length > 0) {
    throw new BadRequestException(
      `Unsupported query parameters: ${keys.join(', ')}. Supported: none`,
    );
  }
}
