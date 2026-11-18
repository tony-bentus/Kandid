import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

const SUPPORTED_PARAMS =
  'status, companyId, from, to, page, limit';

/**
 * Filtros de `GET /v1/applications`: exatamente os seis parâmetros abaixo.
 *
 * A ordem é fixa (`createdAt DESC, id ASC`); `sort` é aceito apenas pelo
 * whitelist para que a rejeição use a mensagem do ADR 0004, e nunca chega ao
 * service. Qualquer outro parâmetro é rejeitado pelo `forbidNonWhitelisted`.
 */
export class ListApplicationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por status da candidatura',
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLIED,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Filtra por empresa da vaga (alheia/inexistente → vazio)',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Início do intervalo sobre createdAt (UTC, YYYY-MM-DD)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    description: 'Fim do intervalo sobre createdAt (UTC, YYYY-MM-DD)',
    example: '2026-11-18',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;

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
