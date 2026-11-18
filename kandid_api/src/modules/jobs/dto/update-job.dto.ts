import { PartialType } from '@nestjs/swagger';
import { CreateJobDto } from './create-job.dto.js';

/**
 * Atualização parcial de vaga (`PATCH /v1/jobs/:id`).
 *
 * Campos ausentes permanecem inalterados. `null` limpa apenas os opcionais;
 * o service rejeita `null` em `companyId`, `title`, `source`, `salaryPeriod`,
 * `currency` e `skills` com 400.
 */
export class UpdateJobDto extends PartialType(CreateJobDto) {}
