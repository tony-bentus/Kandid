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
 * Criação de candidatura (`POST /v1/jobs/:id/applications`).
 *
 * `jobId` vem do path e `userId` do JWT: nenhum dos dois aparece aqui.
 * `status`, `appliedAt`, `closedAt` e `resumeVersionId` também são rejeitados
 * pelo `whitelist`/`forbidNonWhitelisted` global.
 */
export class CreateApplicationDto {
  @ApiPropertyOptional({
    description: 'Valor proposto em centavos',
    example: 950000,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  proposedSalaryCents?: number | null;

  @ApiPropertyOptional({
    description: 'Valor ofertado em centavos',
    example: null,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  offeredSalaryCents?: number | null;

  @ApiPropertyOptional({
    description: 'Moeda ISO 4217 (default: herda da vaga)',
    example: 'BRL',
    pattern: '^[A-Z]{3}$',
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Periodicidade do salário (default: herda da vaga)',
    enum: SalaryPeriod,
    example: SalaryPeriod.MONTH,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsEnum(SalaryPeriod)
  salaryPeriod?: SalaryPeriod;

  @ApiPropertyOptional({
    description: 'Benefícios como array de strings; null limpa o campo',
    example: ['Plano de saúde', 'Vale refeição'],
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[] | null;

  @ApiPropertyOptional({
    description: 'Próximo passo em ISO 8601 UTC',
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  nextStepAt?: string | null;

  @ApiPropertyOptional({
    description: 'Último contato em ISO 8601 UTC',
    example: '2026-11-20T16:30:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  lastContactAt?: string | null;

  @ApiPropertyOptional({
    description: 'Motivo da rejeição',
    example: 'Sem alinhamento de senioridade.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string | null;

  @ApiPropertyOptional({
    description: 'Anotações livres',
    example: 'Candidatura enviada após indicação.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
