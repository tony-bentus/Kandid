import { ApiProperty } from '@nestjs/swagger';
import { InterviewOutcome } from '../../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import { InterviewType } from '../../../common/enums/interview-type.enum.js';

/**
 * Representação pública de uma entrevista. Datas em ISO 8601 UTC e campos
 * descritivos opcionais explícitos como `null` quando não preenchidos.
 */
export class InterviewResponseDto {
  @ApiProperty({ example: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a' })
  id: string;

  @ApiProperty({ example: '7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d' })
  applicationId: string;

  @ApiProperty({ example: 1, minimum: 1 })
  round: number;

  @ApiProperty({ enum: InterviewType, example: InterviewType.TECHNICAL })
  type: InterviewType;

  @ApiProperty({
    description: 'ISO 8601 UTC',
    example: '2026-11-25T14:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  scheduledAt: string;

  @ApiProperty({ example: 60, minimum: 1, maximum: 1440 })
  durationMinutes: number;

  @ApiProperty({ example: 'Maria Silva', nullable: true })
  interviewerName: string | null;

  @ApiProperty({ example: 'Tech Lead', nullable: true })
  interviewerRole: string | null;

  @ApiProperty({
    example: 'https://meet.example.com/abc-123',
    nullable: true,
  })
  meetingUrl: string | null;

  @ApiProperty({ enum: InterviewStatus, example: InterviewStatus.SCHEDULED })
  status: InterviewStatus;

  @ApiProperty({ example: null, nullable: true })
  feedback: string | null;

  @ApiProperty({ enum: InterviewOutcome, example: InterviewOutcome.PENDING })
  outcome: InterviewOutcome;

  @ApiProperty({
    example: '2026-11-19T12:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-11-19T12:00:00.000Z',
    format: 'date-time',
    type: String,
  })
  updatedAt: string;
}
