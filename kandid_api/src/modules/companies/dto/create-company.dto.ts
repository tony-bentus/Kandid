import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CompanyKind } from '../../../common/enums/company-kind.enum.js';
import { CompanySize } from '../../../common/enums/company-size.enum.js';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: true,
};

/**
 * Um opcional em branco é aceito e convertido em `null` pelo service, da mesma
 * forma que os descritivos do perfil. Valores não vazios continuam validados.
 */
const IS_NON_BLANK = (_object: unknown, value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

/** Criação de empresa (`POST /v1/companies`). */
export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme', maxLength: 160 })
  @IsString()
  @Matches(/\S/, { message: 'name must not be empty' })
  @MaxLength(160)
  name: string;

  @ApiProperty({ enum: CompanyKind, example: CompanyKind.CLIENT })
  @IsEnum(CompanyKind)
  kind: CompanyKind;

  @ApiPropertyOptional({
    example: 'https://acme.example.com',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  website?: string | null;

  @ApiPropertyOptional({ example: 'Tecnologia', maxLength: 120, nullable: true })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @ApiPropertyOptional({
    enum: CompanySize,
    example: CompanySize.MEDIUM,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize | null;

  @ApiPropertyOptional({
    example: 'São Paulo, SP',
    maxLength: 160,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  @MaxLength(160)
  location?: string | null;

  @ApiPropertyOptional({ example: 'Cliente de plataforma.', nullable: true })
  @IsOptional()
  @ValidateIf(IS_NON_BLANK)
  @IsString()
  notes?: string | null;
}
