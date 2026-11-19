import { ApiProperty } from '@nestjs/swagger';
import { CountsByStatusDto } from './counts-by-status.dto.js';
import { StageAverageResponseDto } from './stage-average-response.dto.js';

/** Resposta canônica de `GET /v1/dashboard/summary`. */
export class DashboardSummaryResponseDto {
  @ApiProperty({ example: 24 })
  totalApplications: number;

  @ApiProperty({ example: 18 })
  submitted: number;

  @ApiProperty({ type: CountsByStatusDto })
  countsByStatus: CountsByStatusDto;

  @ApiProperty({
    description: 'Percentual 0..100 com 2 casas; null quando submitted é 0',
    type: Number,
    nullable: true,
    example: 77.78,
  })
  responseRate: number | null;

  @ApiProperty({
    description: 'Percentual 0..100 com 2 casas; null quando submitted é 0',
    type: Number,
    nullable: true,
    example: 44.44,
  })
  interviewRate: number | null;

  @ApiProperty({
    description: 'Percentual 0..100 com 2 casas; null quando submitted é 0',
    type: Number,
    nullable: true,
    example: 22.22,
  })
  offerRate: number | null;

  @ApiProperty({
    description: 'Média em dias com 2 casas; null sem amostra',
    type: Number,
    nullable: true,
    example: 4.35,
  })
  averageTimeToFirstResponseDays: number | null;

  @ApiProperty({
    description: '11 itens na ordem do enum ApplicationStatus',
    type: [StageAverageResponseDto],
  })
  averageDaysPerStage: StageAverageResponseDto[];
}
