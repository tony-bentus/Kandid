import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { JobSource } from '../../../common/enums/job-source.enum.js';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { JobSkillResponseDto } from './job-skill-response.dto.js';

/**
 * Representação pública de uma vaga.
 *
 * Inclui o `userId` escalar (contrato da sprint), mas nunca a relação `user`
 * nem qualquer dado de autenticação. Valores em centavos são expostos como
 * número JSON, embora persistidos como `bigint`.
 */
export class JobResponseDto {
  @ApiProperty({ example: '5f607182-93a4-4be1-8031-4c5d6e7f8091' })
  id: string;

  @ApiProperty({ example: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33' })
  userId: string;

  @ApiProperty({ example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d' })
  companyId: string;

  @ApiProperty({
    example: '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e',
    nullable: true,
  })
  recruiterId: string | null;

  @ApiProperty({ example: 'Desenvolvedor Backend Sênior' })
  title: string;

  @ApiProperty({
    example: 'Node.js, TypeScript e PostgreSQL. Remoto.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ enum: Seniority, example: Seniority.SENIOR, nullable: true })
  seniority: Seniority | null;

  @ApiProperty({ enum: WorkModel, example: WorkModel.REMOTE, nullable: true })
  workModel: WorkModel | null;

  @ApiProperty({ enum: ContractType, example: ContractType.CLT, nullable: true })
  contractType: ContractType | null;

  @ApiProperty({ example: 'Remoto', nullable: true })
  location: string | null;

  @ApiProperty({ enum: JobSource, example: JobSource.LINKEDIN })
  source: JobSource;

  @ApiProperty({
    example: 'https://linkedin.com/jobs/view/123',
    nullable: true,
  })
  sourceUrl: string | null;

  @ApiProperty({ description: 'Faixa salarial mínima em centavos', example: 800000, nullable: true })
  salaryRangeMinCents: number | null;

  @ApiProperty({ description: 'Faixa salarial máxima em centavos', example: 1200000, nullable: true })
  salaryRangeMaxCents: number | null;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTH })
  salaryPeriod: SalaryPeriod;

  @ApiProperty({ example: '2026-11-18', nullable: true })
  postedAt: string | null;

  @ApiProperty({ example: '2026-12-18', nullable: true })
  applicationDeadline: string | null;

  @ApiProperty({ example: 'Vaga de plataforma.', nullable: true })
  notes: string | null;

  @ApiProperty({ type: [JobSkillResponseDto] })
  skills: JobSkillResponseDto[];

  @ApiProperty({
    example: '2026-11-18T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-11-18T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
