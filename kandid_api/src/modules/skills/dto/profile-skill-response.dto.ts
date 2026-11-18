import { ApiProperty } from '@nestjs/swagger';
import { SkillLevel } from '../../../common/enums/skill-level.enum.js';
import { SkillResponseDto } from './skill-response.dto.js';

/** Skill vinculada ao perfil, com os dados do catálogo. */
export class ProfileSkillResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  profileId: string;

  @ApiProperty({ example: '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e' })
  skillId: string;

  @ApiProperty({ enum: SkillLevel, example: SkillLevel.ADVANCED })
  level: SkillLevel;

  @ApiProperty({
    description: 'Anos de experiência',
    example: 5.5,
    nullable: true,
  })
  yearsExperience: number | null;

  @ApiProperty({ example: 2026, nullable: true })
  lastUsedYear: number | null;

  @ApiProperty({ type: SkillResponseDto })
  skill: SkillResponseDto;

  @ApiProperty({
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
