import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID } from 'class-validator';

/**
 * Requisição de análise ATS (`POST /v1/resume-versions/:id/analyze`).
 *
 * `userId` e `resumeVersionId` vêm do token/path; campos calculados pelo motor
 * e quaisquer campos fora da whitelist são rejeitados pelo ValidationPipe
 * global (`whitelist` + `forbidNonWhitelisted`).
 */
export class AnalyzeResumeVersionDto {
  @ApiProperty({
    description: 'ID da vaga a ser analisada contra a versão do currículo',
    format: 'uuid',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  })
  @IsDefined()
  @IsUUID()
  jobId: string;
}
