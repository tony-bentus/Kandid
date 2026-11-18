import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

/**
 * Criação de experiência (POST /v1/me/experiences).
 * O `profile_id` é derivado do JWT e não aparece no body.
 */
export class CreateExperienceDto {
  @ApiProperty({ example: 'Acme', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  companyName: string;

  @ApiProperty({ example: 'Backend Developer', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  role: string;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.CLT })
  @IsOptional()
  @IsEnum(ContractType)
  employmentType?: ContractType;

  @ApiPropertyOptional({ enum: WorkModel, example: WorkModel.REMOTE })
  @IsOptional()
  @IsEnum(WorkModel)
  workModel?: WorkModel;

  @ApiPropertyOptional({ example: 'Remoto', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiProperty({
    description: 'Data de início (YYYY-MM-DD)',
    example: '2023-01-01',
  })
  @IsDateOnly()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Data de término (YYYY-MM-DD). Obrigatória se isCurrent=false.',
    example: '2025-06-30',
  })
  @IsOptional()
  @IsDateOnly()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Experiência atual. Se true, endDate deve ser null.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({
    description: 'Descrição livre da experiência',
    example: 'Atuação no time de plataforma.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ordem de exibição (menor primeiro)',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
