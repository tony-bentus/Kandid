import { ApiProperty } from '@nestjs/swagger';
import { SkillCategory } from '../../../common/enums/skill-category.enum.js';

/** Skill do catálogo global retornada por `GET /v1/skills`. */
export class SkillResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: 'Node.js' })
  name: string;

  @ApiProperty({ example: 'node-js' })
  slug: string;

  @ApiProperty({
    enum: SkillCategory,
    example: SkillCategory.FRAMEWORK,
  })
  category: SkillCategory;

  @ApiProperty({
    description: 'Aliases usados pelo motor ATS',
    example: ['Node', 'NodeJS'],
    type: [String],
  })
  aliases: string[];
}
