import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';

/** Transição de status (`PATCH /v1/applications/:id/status`). */
export class UpdateApplicationStatusDto {
  @ApiProperty({
    description: 'Status de destino, validado contra APPLICATION_TRANSITIONS',
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLIED,
  })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Nota da transição; preservada como enviada (sem trim)',
    example: 'Enviada pelo LinkedIn.',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
