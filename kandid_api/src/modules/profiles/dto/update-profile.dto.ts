import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

/**
 * Atualização parcial do perfil (PATCH /v1/me/profile).
 *
 * Todos os campos são opcionais. O `user_id` não existe aqui de propósito:
 * ele vem exclusivamente do JWT.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Título profissional curto',
    example: 'Backend Developer',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  headline?: string;

  @ApiPropertyOptional({
    description: 'Resumo profissional em texto livre',
    example: 'Desenvolvedor backend com foco em Node.js e TypeScript.',
  })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    description: 'Telefone de contato',
    example: '+55 11 99999-9999',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'São Paulo', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'SP', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: 'Brasil', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({
    example: 'https://linkedin.com/in/usuario',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  linkedinUrl?: string;

  @ApiPropertyOptional({
    example: 'https://github.com/usuario',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  githubUrl?: string;

  @ApiPropertyOptional({
    example: 'https://usuario.dev',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  portfolioUrl?: string;

  @ApiPropertyOptional({
    description: 'Cargo desejado',
    example: 'Desenvolvedor Backend Sênior',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  desiredRole?: string;

  @ApiPropertyOptional({ enum: Seniority, example: Seniority.SENIOR })
  @IsOptional()
  @IsEnum(Seniority)
  desiredSeniority?: Seniority;

  @ApiPropertyOptional({ enum: WorkModel, example: WorkModel.REMOTE })
  @IsOptional()
  @IsEnum(WorkModel)
  workModelPreference?: WorkModel;

  @ApiPropertyOptional({
    description: 'Pretensão salarial em centavos',
    example: 1500000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  desiredSalaryCents?: number;

  @ApiPropertyOptional({
    description: 'Moeda ISO 4217',
    example: 'BRL',
    minLength: 3,
    maxLength: 3,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Data de disponibilidade (YYYY-MM-DD)',
    example: '2026-12-01',
  })
  @IsOptional()
  @IsDateOnly()
  availableFrom?: string;
}
