import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';

/** Média de permanência em uma etapa fechada do funil. */
export class StageAverageResponseDto {
  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.SAVED,
  })
  status: ApplicationStatus;

  @ApiProperty({
    description: 'Média em dias com 2 casas; null quando não há segmento fechado',
    type: Number,
    nullable: true,
    example: 2.5,
  })
  averageDays: number | null;

  @ApiProperty({
    description: 'Quantidade de segmentos fechados usados na média',
    example: 18,
  })
  sampleSize: number;
}
