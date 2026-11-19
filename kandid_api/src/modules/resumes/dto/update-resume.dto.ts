import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /v1/resumes/:id`: subconjunto de `CreateResumeDto`.
 *
 * `null` explícito em qualquer campo é rejeitado aqui e pelo service;
 * `targetRole: ''` é válido (representa "cargo alvo não definido").
 */
export class UpdateResumeDto {
  @ApiPropertyOptional({
    description: 'Novo nome do currículo (único por usuário)',
    example: 'Currículo Backend Sênior',
    minLength: 1,
    maxLength: 120,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Novo cargo alvo; string vazia é aceita',
    example: 'Desenvolvedor Backend Sênior',
    maxLength: 160,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(160)
  targetRole?: string;

  @ApiPropertyOptional({
    description:
      'Define ou limpa o default; false pode deixar o usuário sem default',
    example: true,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
}
