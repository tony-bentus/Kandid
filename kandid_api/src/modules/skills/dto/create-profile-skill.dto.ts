import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';

/**
 * Vincula uma skill do catálogo ao perfil (`POST /v1/me/skills`).
 * `profile_id` é derivado do JWT; nunca aparece no body.
 */
export class CreateProfileSkillDto {
  @ApiProperty({
    description: 'ID de uma skill existente no catálogo',
    example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  })
  @IsUUID()
  skillId: string;

  @ApiProperty({ enum: SkillLevel, example: SkillLevel.ADVANCED })
  @IsEnum(SkillLevel)
  level: SkillLevel;

  @ApiPropertyOptional({
    description: 'Anos de experiência (0 a 99.9, uma casa decimal)',
    example: 5.5,
    minimum: 0,
    maximum: 99.9,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(99.9)
  yearsExperience?: number;

  @ApiPropertyOptional({
    description: 'Último ano em que usou a skill (não pode ser futuro)',
    example: 2026,
    minimum: 1950,
  })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  lastUsedYear?: number;
}
