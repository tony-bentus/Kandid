import { ApiProperty } from '@nestjs/swagger';

/** Estatísticas de uma base monetária dentro de um bucket. */
export class CompensationStatsDto {
  @ApiProperty({ example: 6 })
  count: number;

  @ApiProperty({
    description: 'Centavos inteiros; null quando count é 0',
    type: Number,
    nullable: true,
    example: 800000,
  })
  minCents: number | null;

  @ApiProperty({
    description: 'Centavos inteiros; null quando count é 0',
    type: Number,
    nullable: true,
    example: 1500000,
  })
  maxCents: number | null;

  @ApiProperty({
    description: 'Média em centavos inteiros; null quando count é 0',
    type: Number,
    nullable: true,
    example: 1125000,
  })
  averageCents: number | null;
}
