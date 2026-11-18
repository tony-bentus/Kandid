import { PartialType } from '@nestjs/swagger';
import { CreateExperienceDto } from './create-experience.dto.js';

/** Atualização parcial de uma experiência. */
export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}
