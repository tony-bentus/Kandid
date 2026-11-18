import { PartialType } from '@nestjs/swagger';
import { CreateCertificationDto } from './create-certification.dto.js';

/** Atualização parcial de certificação. */
export class UpdateCertificationDto extends PartialType(
  CreateCertificationDto,
) {}
