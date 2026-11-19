import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsIn } from 'class-validator';

/** Formatos aceitos pelo export de versão de currículo (minúsculos, sem default). */
export type ResumeExportFormat = 'json' | 'html';

/**
 * Query estrita de `GET /v1/resume-versions/:id/export`.
 *
 * `format` é obrigatório e aceita somente `json` ou `html`. Ausente, vazio,
 * repetido ou com outra caixa falha no `@IsIn`; qualquer outra chave é
 * recusada pelo `forbidNonWhitelisted` global.
 */
export class ExportResumeVersionQueryDto {
  @Expose()
  @ApiProperty({
    enum: ['json', 'html'],
    example: 'json',
    description: 'Formato do export. Obrigatório, sem valor default.',
  })
  @IsIn(['json', 'html'])
  format: ResumeExportFormat;
}
