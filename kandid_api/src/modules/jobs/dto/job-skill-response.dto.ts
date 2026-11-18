import { ApiProperty } from '@nestjs/swagger';
import { SkillResponseDto } from '../../skills/dto/skill-response.dto.js';

/** Skill da stack de uma vaga, com os dados do catálogo global aninhados. */
export class JobSkillResponseDto {
  @ApiProperty({ example: '3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f' })
  skillId: string;

  @ApiProperty({ example: true })
  isRequired: boolean;

  @ApiProperty({ type: SkillResponseDto })
  skill: SkillResponseDto;
}
