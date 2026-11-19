import { ApiProperty } from '@nestjs/swagger';
import {
  CompensationBucketResponseDto,
  SeniorityCompensationBucketDto,
  SkillCompensationBucketDto,
} from './compensation-bucket-response.dto.js';

/** Resposta canônica de `GET /v1/dashboard/compensation`. */
export class DashboardCompensationResponseDto {
  @ApiProperty({
    description: 'Um item por par (currency, salaryPeriod) com algum valor',
    type: [CompensationBucketResponseDto],
  })
  byCurrency: CompensationBucketResponseDto[];

  @ApiProperty({
    description: 'Mesmo cálculo por senioridade da vaga; inclui bucket null',
    type: [SeniorityCompensationBucketDto],
  })
  bySeniority: SeniorityCompensationBucketDto[];

  @ApiProperty({
    description:
      'Mesmo cálculo por skill da vaga; uma candidatura aparece em vários buckets',
    type: [SkillCompensationBucketDto],
  })
  bySkill: SkillCompensationBucketDto[];
}
