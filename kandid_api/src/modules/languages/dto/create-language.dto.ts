import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';

/** Criação de idioma (`POST /v1/me/languages`). */
export class CreateLanguageDto {
  @ApiProperty({ example: 'Inglês', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({
    enum: LanguageProficiency,
    example: LanguageProficiency.FLUENT,
  })
  @IsEnum(LanguageProficiency)
  proficiency: LanguageProficiency;
}
