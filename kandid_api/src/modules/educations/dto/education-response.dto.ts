import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de uma formação acadêmica. */
export class EducationResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  profileId: string;

  @ApiProperty({ example: 'Universidade de São Paulo' })
  institution: string;

  @ApiProperty({ example: 'Bacharelado' })
  degree: string;

  @ApiProperty({ example: 'Ciência da Computação' })
  fieldOfStudy: string;

  @ApiProperty({ example: '2018-02-01', type: String, format: 'date' })
  startDate: string;

  @ApiProperty({
    example: '2022-12-15',
    type: String,
    format: 'date',
    nullable: true,
  })
  endDate: string | null;

  @ApiProperty({ example: false })
  isCurrent: boolean;

  @ApiProperty({ example: 'TCC sobre sistemas distribuídos.', nullable: true })
  description: string | null;

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
