import { PartialType } from '@nestjs/swagger';
import { CreateCompanyDto } from './create-company.dto.js';

/** Atualização parcial de empresa (`PATCH /v1/companies/:id`). */
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
