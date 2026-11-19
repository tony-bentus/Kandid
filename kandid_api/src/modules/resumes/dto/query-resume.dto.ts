import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const SUPPORTED_PARAMS = 'page, limit';

/**
 * Filtros de `GET /v1/resumes`: somente `page` e `limit`.
 *
 * A ordem é fixa (`createdAt DESC, id ASC`). `sort` entra na whitelist apenas
 * para produzir a mensagem de erro do ADR 0004; qualquer outro parâmetro é
 * recusado pelo `forbidNonWhitelisted` global.
 */
export class QueryResumeDto {
  @ApiPropertyOptional({
    description: 'Página (1-based)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Itens por página',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiHideProperty()
  @Allow()
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsIn([], {
    message: `Unsupported query parameters: sort. Supported: ${SUPPORTED_PARAMS}`,
  })
  sort?: never;
}
