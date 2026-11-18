import { ApiProperty } from '@nestjs/swagger';
import { LanguageProficiency } from '../../../common/enums/language-proficiency.enum.js';

/** Representação pública de um idioma. */
export class LanguageResponseDto {
  @ApiProperty({ example: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12' })
  id: string;

  @ApiProperty({ example: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d' })
  profileId: string;

  @ApiProperty({ example: 'Inglês' })
  name: string;

  @ApiProperty({
    enum: LanguageProficiency,
    example: LanguageProficiency.FLUENT,
  })
  proficiency: LanguageProficiency;

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
