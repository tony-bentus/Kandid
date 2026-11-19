import { ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';
import { InterviewOutcome } from '../../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import { InterviewType } from '../../../common/enums/interview-type.enum.js';
import { ISO_WITH_TIMEZONE } from './create-interview.dto.js';
import { PreserveRawInteger } from './preserve-raw-integer.js';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

/**
 * Atualização parcial de entrevista (`PATCH .../interviews/:interviewId`).
 *
 * Campos ausentes não mudam (`hasField` no service); body vazio é no-op. `null`
 * limpa apenas `interviewerName`, `interviewerRole`, `meetingUrl` e `feedback`.
 * Nos campos obrigatórios, `ValidateIf(value !== undefined)` mantém `null` na
 * validação para que `@IsInt`/`@IsEnum`/`@IsISO8601` respondam 400.
 */
export class UpdateInterviewDto {
  @ApiPropertyOptional({
    description: 'Nova rodada (deve estar livre na candidatura)',
    example: 2,
    minimum: 1,
  })
  @PreserveRawInteger()
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  round?: number;

  @ApiPropertyOptional({ enum: InterviewType, example: InterviewType.HR })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional({
    description: 'Data/hora ISO 8601 com timezone; normalizada para UTC',
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    pattern: ISO_WITH_TIMEZONE.source,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(ISO_WITH_TIMEZONE, {
    message: 'scheduledAt must be an ISO 8601 datetime with timezone',
  })
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Duração em minutos',
    example: 90,
    minimum: 1,
    maximum: 1440,
  })
  @PreserveRawInteger()
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Nome do entrevistador; null limpa o campo',
    example: 'Maria Silva',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerName?: string | null;

  @ApiPropertyOptional({
    description: 'Cargo do entrevistador; null limpa o campo',
    example: 'Tech Lead',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerRole?: string | null;

  @ApiPropertyOptional({
    description: 'URL da reunião (somente http/https); null limpa o campo',
    example: 'https://meet.example.com/abc-123',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_OPTIONS)
  @MaxLength(255)
  meetingUrl?: string | null;

  @ApiPropertyOptional({
    enum: InterviewStatus,
    example: InterviewStatus.COMPLETED,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @ApiPropertyOptional({
    description: 'Feedback livre; null limpa o campo',
    example: 'Boa discussão sobre arquitetura.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string | null;

  @ApiPropertyOptional({
    enum: InterviewOutcome,
    example: InterviewOutcome.PASSED,
  })
  @ValidateIf((_object: object, value: unknown) => value !== undefined)
  @IsEnum(InterviewOutcome)
  outcome?: InterviewOutcome;
}
