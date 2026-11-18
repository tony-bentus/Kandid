import { PartialType } from '@nestjs/swagger';
import { CreateLanguageDto } from './create-language.dto.js';

/** Atualização parcial de idioma. */
export class UpdateLanguageDto extends PartialType(CreateLanguageDto) {}
