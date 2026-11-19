import { ApiProperty } from '@nestjs/swagger';
import type { ResumeSnapshot } from '../../ats/engine/types.js';

/**
 * Corpo do export JSON: exatamente quatro campos, nesta ordem, sem envelope.
 *
 * `contentSnapshot` é o JSON persistido, integral e sem transformação.
 * `atsScore` vem da análise ATS mais recente (`ats_analyses`), nunca da coluna
 * `resume_versions.ats_score`.
 */
export class ResumeExportResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
  })
  resumeId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  version: number;

  @ApiProperty({
    description: 'Score da análise mais recente, ou null quando não há análise',
    example: 78,
    nullable: true,
    type: Number,
  })
  atsScore: number | null;

  @ApiProperty({
    description: 'Snapshot imutável do currículo, exatamente como persistido',
    type: Object,
  })
  contentSnapshot: ResumeSnapshot;
}
