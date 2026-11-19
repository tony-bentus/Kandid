import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

/**
 * `POST /v1/resumes`. `userId`/`user_id`, `id`, `createdAt`, `updatedAt`,
 * `is_default` e `versions` são rejeitados pelo `forbidNonWhitelisted` global.
 */
export class CreateResumeDto {
  @ApiProperty({
    description: 'Nome do currículo, único por usuário',
    example: 'Currículo Backend',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({
    description:
      'Cargo alvo; quando omitido, herda desired_role do perfil (ou string vazia)',
    example: 'Desenvolvedor Backend Sênior',
    maxLength: 160,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(160)
  targetRole?: string;

  @ApiPropertyOptional({
    description:
      'Marca como default; o primeiro currículo do usuário vira default mesmo com false',
    example: true,
    default: false,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
}
