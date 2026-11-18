import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';

/** Linha append-only do histórico de status; nunca expõe `userId`. */
export class ApplicationStatusHistoryResponseDto {
  @ApiProperty({ example: '9c0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f' })
  id: string;

  @ApiProperty({ example: '7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d' })
  applicationId: string;

  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.SAVED,
    nullable: true,
  })
  fromStatus: ApplicationStatus | null;

  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.APPLIED })
  toStatus: ApplicationStatus;

  @ApiProperty({ example: 'Enviada pelo LinkedIn.', nullable: true })
  note: string | null;

  @ApiProperty({ example: '2026-11-18T13:00:00.000Z', format: 'date-time', type: String })
  changedAt: string;
}
