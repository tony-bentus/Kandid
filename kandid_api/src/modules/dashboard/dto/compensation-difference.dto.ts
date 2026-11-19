import { ApiProperty } from '@nestjs/swagger';

/** Diferença calculada somente sobre a amostra pareada. */
export class CompensationDifferenceDto {
  @ApiProperty({
    description:
      'Média pareada de offered - proposed em centavos inteiros, com sinal; null sem pares',
    type: Number,
    nullable: true,
    example: 133333,
  })
  absoluteCents: number | null;

  @ApiProperty({
    description:
      'Percentual 0..100 com 2 casas sobre a média pareada dos propostos; null sem pares ou com média dos propostos <= 0',
    type: Number,
    nullable: true,
    example: 12.7,
  })
  percentage: number | null;

  @ApiProperty({ example: 3 })
  pairedSampleSize: number;
}
