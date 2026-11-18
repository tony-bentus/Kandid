import { BadRequestException } from '@nestjs/common';

/**
 * Verifica se o campo foi efetivamente enviado no payload.
 *
 * O `ValidationPipe` global usa `enableImplicitConversion`, e o
 * `class-transformer` materializa todas as propriedades declaradas no DTO com
 * valor `undefined`. Essas chaves não representam um valor enviado: tratá-las
 * como presentes limparia campos que o cliente não tocou. `null`, por outro
 * lado, é um valor explícito e continua sendo considerado presente.
 */
export function hasField(dto: object, field: string): boolean {
  return (
    Object.prototype.hasOwnProperty.call(dto, field) &&
    (dto as Record<string, unknown>)[field] !== undefined
  );
}

/**
 * Rejeita `null` explícito em campos que PartialType trataria como ausentes.
 * A ausência do campo é permitida e preservada pelo service.
 */
export function assertNoForcedNull(
  dto: object,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (
      hasField(dto, field) &&
      (dto as Record<string, unknown>)[field] === null
    ) {
      throw new BadRequestException(`${field} cannot be null`);
    }
  }
}
