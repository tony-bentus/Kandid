import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

/** Criação de formação acadêmica (`POST /v1/me/educations`). */
export class CreateEducationDto {
  @ApiProperty({ example: 'Universidade de São Paulo', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  institution: string;

  @ApiProperty({ example: 'Bacharelado', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  degree: string;

  @ApiProperty({ example: 'Ciência da Computação', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  fieldOfStudy: string;

  @ApiProperty({
    description: 'Data de início (YYYY-MM-DD)',
    example: '2018-02-01',
  })
  @IsDateOnly()
  startDate: string;

  @ApiPropertyOptional({
    description: 'Data de término (YYYY-MM-DD). Obrigatória se isCurrent=false.',
    example: '2022-12-15',
  })
  @IsOptional()
  @IsDateOnly()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Formação em andamento. Se true, endDate deve ser null.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({ example: 'TCC sobre sistemas distribuídos.' })
  @IsOptional()
  @IsString()
  description?: string;
}
