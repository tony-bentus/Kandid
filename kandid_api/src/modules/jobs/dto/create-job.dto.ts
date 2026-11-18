import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { JobSource } from '../../../common/enums/job-source.enum.js';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

/**
 * Item da stack de uma vaga. Não existe rota própria para `job_skill`: o
 * vínculo viaja embutido no payload de `job`.
 */
export class JobSkillDto {
  @ApiProperty({
    description: 'ID de uma skill existente no catálogo global',
    example: '3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f',
  })
  @IsUUID()
  skillId: string;

  @ApiPropertyOptional({
    description: 'Indica se a skill é obrigatória (padrão: true)',
    example: true,
    default: true,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsBoolean()
  isRequired?: boolean;
}

/**
 * Criação de vaga (`POST /v1/jobs`).
 *
 * `userId` não aparece de propósito: ele vem exclusivamente do JWT.
 * `companyId`, `title`, `source` e `salaryPeriod` são obrigatórios;
 * `currency` tem default `BRL`.
 */
export class CreateJobDto {
  @ApiProperty({
    description: 'ID de uma empresa do usuário autenticado',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    description: 'ID de um recrutador do usuário autenticado',
    example: '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e',
  })
  @IsOptional()
  @IsUUID()
  recruiterId?: string | null;

  @ApiProperty({
    description: 'Título da vaga',
    example: 'Desenvolvedor Backend Sênior',
    maxLength: 160,
  })
  @IsString()
  @Matches(/\S/, { message: 'title must not be empty' })
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({
    description: 'Descrição da vaga',
    example: 'Node.js, TypeScript e PostgreSQL. Remoto.',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: Seniority, example: Seniority.SENIOR })
  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority | null;

  @ApiPropertyOptional({ enum: WorkModel, example: WorkModel.REMOTE })
  @IsOptional()
  @IsEnum(WorkModel)
  workModel?: WorkModel | null;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.CLT })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType | null;

  @ApiPropertyOptional({ example: 'Remoto', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @ApiProperty({ enum: JobSource, example: JobSource.LINKEDIN })
  @IsEnum(JobSource)
  source: JobSource;

  @ApiPropertyOptional({
    example: 'https://linkedin.com/jobs/view/123',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  sourceUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Limite inferior da faixa salarial em centavos',
    example: 800000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryRangeMinCents?: number | null;

  @ApiPropertyOptional({
    description: 'Limite superior da faixa salarial em centavos',
    example: 1200000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryRangeMaxCents?: number | null;

  @ApiPropertyOptional({
    description: 'Moeda ISO 4217 (default: BRL)',
    example: 'BRL',
    minLength: 3,
    maxLength: 3,
    default: 'BRL',
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTH })
  @IsEnum(SalaryPeriod)
  salaryPeriod: SalaryPeriod;

  @ApiPropertyOptional({
    description: 'Data de publicação (YYYY-MM-DD)',
    example: '2026-11-18',
  })
  @IsOptional()
  @IsDateOnly()
  postedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Prazo de candidatura (YYYY-MM-DD)',
    example: '2026-12-18',
  })
  @IsOptional()
  @IsDateOnly()
  applicationDeadline?: string | null;

  @ApiPropertyOptional({
    description:
      'Stack da vaga; skillId repetido é rejeitado e isRequired default é true',
    type: [JobSkillDto],
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => JobSkillDto)
  skills?: JobSkillDto[] | null;

  @ApiPropertyOptional({
    description: 'Anotações livres',
    example: 'Vaga de plataforma.',
  })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
