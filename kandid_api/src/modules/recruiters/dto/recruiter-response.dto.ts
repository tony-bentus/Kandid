import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de um recrutador do usuário autenticado. */
export class RecruiterResponseDto {
  @ApiProperty({ example: '2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e' })
  id: string;

  @ApiProperty({ example: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33' })
  userId: string;

  @ApiProperty({ example: 'Marina Costa' })
  name: string;

  @ApiProperty({ example: 'marina@talent.example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+55 11 98888-7777', nullable: true })
  phone: string | null;

  @ApiProperty({
    example: 'https://linkedin.com/in/marina-costa',
    nullable: true,
  })
  linkedinUrl: string | null;

  @ApiProperty({
    example: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
    nullable: true,
  })
  agencyCompanyId: string | null;

  @ApiProperty({ example: 'Recrutadora de vagas de tecnologia.', nullable: true })
  notes: string | null;

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
