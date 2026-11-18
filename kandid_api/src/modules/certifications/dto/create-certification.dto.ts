import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../../common/validators/is-date-only.validator.js';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

/** Criação de certificação (`POST /v1/me/certifications`). */
export class CreateCertificationDto {
  @ApiProperty({ example: 'AWS Certified Solutions Architect', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'Amazon Web Services', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  issuer: string;

  @ApiProperty({
    description: 'Data de emissão (YYYY-MM-DD)',
    example: '2024-03-10',
  })
  @IsDateOnly()
  issueDate: string;

  @ApiPropertyOptional({
    description: 'Data de expiração (YYYY-MM-DD), se houver',
    example: '2027-03-10',
  })
  @IsOptional()
  @IsDateOnly()
  expiryDate?: string;

  @ApiPropertyOptional({
    example: 'https://www.credly.com/badges/exemplo',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  credentialUrl?: string;

  @ApiPropertyOptional({ example: 'ABC-123-XYZ', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  credentialId?: string;
}
