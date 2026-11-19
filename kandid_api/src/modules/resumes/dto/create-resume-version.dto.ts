import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/**
 * `POST /v1/resumes/:id/versions`. `resumeId` vem do path e `userId` do JWT;
 * `version`, `contentSnapshot`, `atsScore` e `createdAt` não pertencem ao corpo
 * e são rejeitados pelo `forbidNonWhitelisted` global.
 */
export class CreateResumeVersionDto {
  @ApiPropertyOptional({
    description: 'Vaga do usuário a associar à versão; omitido → null',
    example: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
    format: 'uuid',
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsUUID()
  jobId?: string;
}
