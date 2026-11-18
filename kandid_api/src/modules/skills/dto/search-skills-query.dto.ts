import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Query de autocomplete do catálogo: `GET /v1/skills?q=node&limit=20`.
 * `q` vazio/ausente pode listar as skills mais usadas ou as primeiras do catálogo.
 */
export class SearchSkillsQueryDto {
  @ApiPropertyOptional({
    description: 'Trecho do nome ou alias da skill',
    example: 'node',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({
    description: 'Máximo de resultados (1–50)',
    example: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
