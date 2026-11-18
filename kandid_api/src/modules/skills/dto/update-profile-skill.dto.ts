import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProfileSkillDto } from './create-profile-skill.dto.js';

/**
 * Atualização parcial do vínculo com a skill.
 * `skillId` é imutável: para trocar a skill, remova e recrie o vínculo.
 */
export class UpdateProfileSkillDto extends PartialType(
  OmitType(CreateProfileSkillDto, ['skillId'] as const),
) {}
