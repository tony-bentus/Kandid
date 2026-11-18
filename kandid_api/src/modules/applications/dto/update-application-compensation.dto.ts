import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';

/**
 * Atualização parcial de compensação e campos descritivos
 * (`PATCH /v1/applications/:id/compensation`).
 *
 * Campos ausentes permanecem inalterados (`hasField` no service). `null` limpa
 * apenas `benefits`, `notes`, `nextStepAt`, `lastContactAt` e
 * `rejectionReason`; em centavos, moeda e periodicidade é 400.
 */
export class UpdateApplicationCompensationDto {
  @ApiPropertyOptional({
    description: 'Valor proposto em centavos',
    example: 950000,
    minimum: 0,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  proposedSalaryCents?: number;

  @ApiPropertyOptional({
    description: 'Valor ofertado em centavos',
    example: 1100000,
    minimum: 0,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  offeredSalaryCents?: number;

  @ApiPropertyOptional({
    description: 'Moeda ISO 4217',
    example: 'BRL',
    pattern: '^[A-Z]{3}$',
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Periodicidade do salário',
    enum: SalaryPeriod,
    example: SalaryPeriod.MONTH,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @ApiPropertyOptional({
    description: 'Array de strings substitui o anterior; null limpa',
    example: ['Plano de saúde', 'Vale refeição', 'Auxílio home office'],
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[] | null;

  @ApiPropertyOptional({
    description: 'Anotações livres; null limpa',
    example: 'Candidatura enviada após indicação.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({
    description: 'Próximo passo em ISO 8601 UTC; null limpa',
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  nextStepAt?: string | null;

  @ApiPropertyOptional({
    description: 'Último contato em ISO 8601 UTC; null limpa',
    example: '2026-11-20T16:30:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  lastContactAt?: string | null;

  @ApiPropertyOptional({
    description: 'Motivo da rejeição; null limpa',
    example: 'Sem alinhamento de senioridade.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string | null;
}
