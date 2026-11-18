import { ApiProperty } from '@nestjs/swagger';
import { CompanyKind } from '../../../common/enums/company-kind.enum.js';
import { CompanySize } from '../../../common/enums/company-size.enum.js';

/** Representação pública de uma empresa do usuário autenticado. */
export class CompanyResponseDto {
  @ApiProperty({ example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33' })
  userId: string;

  @ApiProperty({ example: 'Acme' })
  name: string;

  @ApiProperty({ enum: CompanyKind, example: CompanyKind.CLIENT })
  kind: CompanyKind;

  @ApiProperty({
    example: 'https://acme.example.com',
    nullable: true,
  })
  website: string | null;

  @ApiProperty({ example: 'Tecnologia', nullable: true })
  industry: string | null;

  @ApiProperty({
    enum: CompanySize,
    example: CompanySize.MEDIUM,
    nullable: true,
  })
  size: CompanySize | null;

  @ApiProperty({ example: 'São Paulo, SP', nullable: true })
  location: string | null;

  @ApiProperty({ example: 'Cliente de plataforma.', nullable: true })
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
