import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';

/**
 * Representação pública de uma candidatura.
 *
 * `userId` é somente leitura (igual ao `sub` do JWT) e `resumeVersionId`
 * permanece `null` até a Sprint 5. Centavos são expostos como número JSON.
 */
export class ApplicationResponseDto {
  @ApiProperty({ example: '7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d' })
  id: string;

  @ApiProperty({ example: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33' })
  userId: string;

  @ApiProperty({ example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d' })
  jobId: string;

  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.SAVED,
  })
  status: ApplicationStatus;

  @ApiProperty({ example: '2026-11-18', nullable: true })
  appliedAt: string | null;

  @ApiProperty({
    description: 'Reservado para a Sprint 5; sempre null nesta sprint',
    example: null,
    nullable: true,
    type: String,
  })
  resumeVersionId: null;

  @ApiProperty({ description: 'Valor proposto em centavos', example: 950000, nullable: true })
  proposedSalaryCents: number | null;

  @ApiProperty({ description: 'Valor ofertado em centavos', example: 1100000, nullable: true })
  offeredSalaryCents: number | null;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTH })
  salaryPeriod: SalaryPeriod;

  @ApiProperty({
    example: ['Plano de saúde', 'Vale refeição'],
    type: [String],
    nullable: true,
  })
  benefits: string[] | null;

  @ApiProperty({
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  nextStepAt: string | null;

  @ApiProperty({
    example: '2026-11-20T16:30:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  lastContactAt: string | null;

  @ApiProperty({
    example: 'Sem alinhamento de senioridade.',
    maxLength: 500,
    nullable: true,
  })
  rejectionReason: string | null;

  @ApiProperty({
    example: '2026-11-22T09:00:00.000Z',
    format: 'date-time',
    nullable: true,
    type: String,
  })
  closedAt: string | null;

  @ApiProperty({ example: 'Candidatura enviada após indicação.', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-11-18T12:00:00.000Z', format: 'date-time', type: String })
  createdAt: string;

  @ApiProperty({ example: '2026-11-18T12:00:00.000Z', format: 'date-time', type: String })
  updatedAt: string;
}
