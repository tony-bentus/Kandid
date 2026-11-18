import { ApiProperty } from '@nestjs/swagger';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { WorkModel } from '../../../common/enums/work-model.enum.js';

/**
 * Representação pública do perfil.
 * Nunca inclua dados de autenticação (`password_hash` etc.).
 */
export class ProfileResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  userId: string;

  @ApiProperty({ example: 'Backend Developer', nullable: true })
  headline: string | null;

  @ApiProperty({
    example: 'Desenvolvedor backend com foco em Node.js e TypeScript.',
    nullable: true,
  })
  summary: string | null;

  @ApiProperty({ example: '+55 11 99999-9999', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'São Paulo', nullable: true })
  city: string | null;

  @ApiProperty({ example: 'SP', nullable: true })
  state: string | null;

  @ApiProperty({ example: 'Brasil', nullable: true })
  country: string | null;

  @ApiProperty({
    example: 'https://linkedin.com/in/usuario',
    nullable: true,
  })
  linkedinUrl: string | null;

  @ApiProperty({ example: 'https://github.com/usuario', nullable: true })
  githubUrl: string | null;

  @ApiProperty({ example: 'https://usuario.dev', nullable: true })
  portfolioUrl: string | null;

  @ApiProperty({ example: 'Desenvolvedor Backend Sênior', nullable: true })
  desiredRole: string | null;

  @ApiProperty({
    enum: Seniority,
    example: Seniority.SENIOR,
    nullable: true,
  })
  desiredSeniority: Seniority | null;

  @ApiProperty({
    enum: WorkModel,
    example: WorkModel.REMOTE,
    nullable: true,
  })
  workModelPreference: WorkModel | null;

  @ApiProperty({
    description: 'Pretensão salarial em centavos',
    example: 1500000,
    nullable: true,
  })
  desiredSalaryCents: number | null;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({
    description: 'Data de disponibilidade (YYYY-MM-DD)',
    example: '2026-12-01',
    nullable: true,
  })
  availableFrom: string | null;

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
