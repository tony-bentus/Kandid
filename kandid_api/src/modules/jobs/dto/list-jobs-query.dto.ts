import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Seniority } from '../../../common/enums/seniority.enum.js';

/**
 * Filtros de `GET /v1/jobs`.
 *
 * `status` e `sort` não existem neste DTO de propósito: o `forbidNonWhitelisted`
 * global rejeita ambos com 400. A ordenação é fixa e estável.
 */
export class ListJobsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por empresa do usuário; empresa alheia devolve lista vazia',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filtra por senioridade',
    enum: Seniority,
    example: Seniority.SENIOR,
  })
  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;

  @ApiPropertyOptional({
    description: 'Filtra vagas cuja stack contém a skill (obrigatória ou não)',
    example: '3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f',
  })
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiPropertyOptional({
    description:
      'Termo normalizado (trim, lowercase, sem acentos) buscado em title e description',
    example: 'node',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ description: 'Página (1-based)', example: 1, minimum: 1, default: 1 })
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
}
