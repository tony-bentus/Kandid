import { PartialType } from '@nestjs/swagger';
import { CreateEducationDto } from './create-education.dto.js';

/** Atualização parcial de formação acadêmica. */
export class UpdateEducationDto extends PartialType(CreateEducationDto) {}
