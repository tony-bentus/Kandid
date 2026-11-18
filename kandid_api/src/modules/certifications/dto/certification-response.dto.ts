import { ApiProperty } from '@nestjs/swagger';

/** Representação pública de uma certificação. */
export class CertificationResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  profileId: string;

  @ApiProperty({ example: 'AWS Certified Solutions Architect' })
  name: string;

  @ApiProperty({ example: 'Amazon Web Services' })
  issuer: string;

  @ApiProperty({ example: '2024-03-10', type: String, format: 'date' })
  issueDate: string;

  @ApiProperty({
    example: '2027-03-10',
    type: String,
    format: 'date',
    nullable: true,
  })
  expiryDate: string | null;

  @ApiProperty({
    example: 'https://www.credly.com/badges/exemplo',
    nullable: true,
  })
  credentialUrl: string | null;

  @ApiProperty({ example: 'ABC-123-XYZ', nullable: true })
  credentialId: string | null;

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
