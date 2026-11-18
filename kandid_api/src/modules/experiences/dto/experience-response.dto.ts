import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '../../../common/enums/contract-type.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';
import { ExperienceBulletResponseDto } from './experience-bullet-response.dto.js';

/** Representação pública de uma experiência, incluindo suas bullets. */
export class ExperienceResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  profileId: string;

  @ApiProperty({ example: 'Acme' })
  companyName: string;

  @ApiProperty({ example: 'Backend Developer' })
  role: string;

  @ApiProperty({
    enum: ContractType,
    example: ContractType.CLT,
    nullable: true,
  })
  employmentType: ContractType | null;

  @ApiProperty({
    enum: WorkModel,
    example: WorkModel.REMOTE,
    nullable: true,
  })
  workModel: WorkModel | null;

  @ApiProperty({ example: 'Remoto', nullable: true })
  location: string | null;

  @ApiProperty({
    example: '2023-01-01',
    type: String,
    format: 'date',
  })
  startDate: string;

  @ApiProperty({
    example: '2025-06-30',
    type: String,
    format: 'date',
    nullable: true,
  })
  endDate: string | null;

  @ApiProperty({ example: false })
  isCurrent: boolean;

  @ApiProperty({
    example: 'Atuação no time de plataforma.',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  @ApiProperty({
    type: [ExperienceBulletResponseDto],
    description: 'Bullets da experiência, ordenadas por sortOrder',
  })
  bullets: ExperienceBulletResponseDto[];

  @ApiProperty({
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-11-09T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
