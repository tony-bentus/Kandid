import { ApiProperty } from '@nestjs/swagger';
import type { ResumeSnapshot } from '../../ats/engine/types.js';

/**
 * Representação pública de uma versão imutável do currículo.
 *
 * `atsScore` é sempre `null` nesta sprint (ADR 0005, decisão 11): a coluna
 * `resume_versions.ats_score` nunca é escrita; o score vigente é lido de
 * `ats_analyses`. Não há `updatedAt`.
 */
export class ResumeVersionResponseDto {
  @ApiProperty({ example: '8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d' })
  id: string;

  @ApiProperty({ example: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b' })
  resumeId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  version: number;

  @ApiProperty({
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
    nullable: true,
    type: String,
  })
  jobId: string | null;

  @ApiProperty({
    description: 'Snapshot imutável do currículo (schemaVersion 1.0)',
    type: Object,
  })
  contentSnapshot: ResumeSnapshot;

  @ApiProperty({
    description: 'Sempre null nesta sprint; score vigente vive em ats_analyses',
    example: null,
    nullable: true,
    type: Number,
  })
  atsScore: number | null;

  @ApiProperty({ example: '2026-11-19T12:05:00.000Z', format: 'date-time', type: String })
  createdAt: string;
}
