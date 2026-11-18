import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

/** Um opcional em branco é aceito e convertido em `null` pelo service. */
const IS_NON_BLANK = (_object: unknown, value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

/** Criação de recrutador (`POST /v1/recruiters`). */
export class CreateRecruiterDto {
  @ApiProperty({ example: 'Marina Costa', maxLength: 120 })
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'marina@talent.example.com',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsEmail()
  @MaxLength(160)
  email?: string | null;

  @ApiPropertyOptional({ example: '+55 11 98888-7777', maxLength: 30, nullable: true })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'https://linkedin.com/in/marina-costa',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  linkedinUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Empresa do mesmo usuário (qualquer kind)',
    example: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  agencyCompanyId?: string | null;

  @ApiPropertyOptional({
    example: 'Recrutadora de vagas de tecnologia.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  notes?: string | null;
}
