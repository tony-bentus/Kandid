import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InterviewOutcome } from '../../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import { InterviewType } from '../../../common/enums/interview-type.enum.js';
import { PreserveRawInteger } from './preserve-raw-integer.js';

/** ISO 8601 com indicador de timezone obrigatório (`Z` ou `±HH:MM`). */
const ISO_WITH_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

/**
 * Criação de entrevista (`POST /v1/applications/:id/interviews`).
 *
 * `applicationId` vem do path e `userId` do JWT: nenhum dos dois aparece aqui.
 * `createdAt`, `updatedAt`, `id` e também `status`/`outcome` informados ficam
 * dentro da whitelist apenas nos dois últimos casos — os demais são rejeitados
 * pelo `forbidNonWhitelisted` global.
 */
export class CreateInterviewDto {
  @ApiProperty({
    description: 'Rodada informada pelo cliente (única por candidatura)',
    example: 1,
    minimum: 1,
  })
  @PreserveRawInteger()
  @IsInt()
  @Min(1)
  round: number;

  @ApiProperty({ enum: InterviewType, example: InterviewType.TECHNICAL })
  @IsEnum(InterviewType)
  type: InterviewType;

  @ApiProperty({
    description: 'Data/hora ISO 8601 com timezone; normalizada para UTC',
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    pattern: ISO_WITH_TIMEZONE.source,
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_WITH_TIMEZONE, {
    message: 'scheduledAt must be an ISO 8601 datetime with timezone',
  })
  scheduledAt: string;

  @ApiProperty({
    description: 'Duração em minutos',
    example: 60,
    minimum: 1,
    maximum: 1440,
  })
  @PreserveRawInteger()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;

  @ApiPropertyOptional({
    description: 'Nome do entrevistador; null quando omitido',
    example: 'Maria Silva',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerName?: string | null;

  @ApiPropertyOptional({
    description: 'Cargo do entrevistador; null quando omitido',
    example: 'Tech Lead',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerRole?: string | null;

  @ApiPropertyOptional({
    description: 'URL da reunião (somente http/https); null quando omitida',
    example: 'https://meet.example.com/abc-123',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  meetingUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Situação inicial (default: SCHEDULED)',
    enum: InterviewStatus,
    example: InterviewStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @ApiPropertyOptional({
    description: 'Feedback livre; null quando omitido',
    example: 'Boa discussão sobre arquitetura.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string | null;

  @ApiPropertyOptional({
    description: 'Resultado (default: PENDING)',
    enum: InterviewOutcome,
    example: InterviewOutcome.PENDING,
  })
  @IsOptional()
  @IsEnum(InterviewOutcome)
  outcome?: InterviewOutcome;
}

export { ISO_WITH_TIMEZONE };
