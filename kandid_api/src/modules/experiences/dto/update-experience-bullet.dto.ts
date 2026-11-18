import { PartialType } from '@nestjs/swagger';
import { CreateExperienceBulletDto } from './create-experience-bullet.dto.js';

/** Atualização parcial de uma bullet. */
export class UpdateExperienceBulletDto extends PartialType(
  CreateExperienceBulletDto,
) {}
