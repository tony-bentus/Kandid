import { PartialType } from '@nestjs/swagger';
import { CreateRecruiterDto } from './create-recruiter.dto.js';

/** Atualização parcial de recrutador (`PATCH /v1/recruiters/:id`). */
export class UpdateRecruiterDto extends PartialType(CreateRecruiterDto) {}
