import { ApiProperty } from '@nestjs/swagger';
import { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import { Seniority } from '../../../common/enums/seniority.enum.js';
import { CompensationDifferenceDto } from './compensation-difference.dto.js';
import { CompensationStatsDto } from './compensation-stats.dto.js';

/** Bucket por par `(currency, salaryPeriod)` — nunca cruza moeda ou período. */
export class CompensationBucketResponseDto {
  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ enum: SalaryPeriod, example: SalaryPeriod.MONTH })
  salaryPeriod: SalaryPeriod;

  @ApiProperty({
    description: 'Candidaturas com pelo menos um valor monetário no bucket',
    example: 7,
  })
  applicationCount: number;

  @ApiProperty({ type: CompensationStatsDto })
  proposed: CompensationStatsDto;

  @ApiProperty({ type: CompensationStatsDto })
  offered: CompensationStatsDto;

  @ApiProperty({ type: CompensationDifferenceDto })
  difference: CompensationDifferenceDto;
}

export class SeniorityCompensationBucketDto extends CompensationBucketResponseDto {
  @ApiProperty({
    description: 'Senioridade da vaga; null quando não informada',
    enum: Seniority,
    nullable: true,
    example: Seniority.SENIOR,
  })
  seniority: Seniority | null;
}

export class SkillCompensationBucketDto extends CompensationBucketResponseDto {
  @ApiProperty({ example: '0b6f9f2e-4a3b-4c5d-8e6f-1a2b3c4d5e6f' })
  skillId: string;

  @ApiProperty({ example: 'Node.js' })
  skillName: string;
}
