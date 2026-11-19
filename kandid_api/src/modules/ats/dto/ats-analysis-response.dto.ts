import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de uma análise ATS persistida. */
export class AtsAnalysisResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: '8f4b7c2d-3a1e-4f9b-8d6c-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    format: 'uuid',
    example: '2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081',
  })
  resumeVersionId: string;

  @ApiProperty({
    format: 'uuid',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  })
  jobId: string;

  @ApiProperty({
    description: 'Score final 0..100 calculado pelo motor determinístico',
    example: 78,
    minimum: 0,
    maximum: 100,
  })
  score: number;

  @ApiProperty({
    description: 'Dimensões do score (35/10/20/15/10/5/5) com renormalização',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        dimension: { type: 'string', example: 'requiredSkills' },
        weight: { type: 'number', example: 35 },
        effectiveWeight: { type: 'number', example: 35 },
        earned: { type: 'number', nullable: true, example: 28 },
        applicable: { type: 'boolean', example: true },
        matched: {
          type: 'array',
          items: { type: 'string' },
          example: ['Node.js', 'TypeScript'],
        },
        missing: {
          type: 'array',
          items: { type: 'string' },
          example: ['Kubernetes'],
        },
        detail: {
          type: 'string',
          nullable: true,
          example: '2 de 3 skills obrigatórias encontradas',
        },
      },
    },
  })
  breakdown: unknown[];

  @ApiProperty({
    description: 'Checks estruturais avaliados no snapshot',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'has-summary' },
        passed: { type: 'boolean', example: true },
        detail: { type: 'string', nullable: true, example: null },
      },
    },
  })
  checks: unknown[];

  @ApiProperty({
    description:
      'União deduplicada de skills encontradas (obrigatórias e desejáveis)',
    type: [String],
    example: ['Node.js', 'TypeScript'],
  })
  matchedKeywords: string[];

  @ApiProperty({
    description: 'Skills obrigatórias não encontradas no snapshot',
    type: [String],
    example: ['Kubernetes'],
  })
  missingKeywords: string[];

  @ApiProperty({
    example: '2026-11-19T12:10:00.000Z',
    format: 'date-time',
    type: String,
  })
  createdAt: string;
}
