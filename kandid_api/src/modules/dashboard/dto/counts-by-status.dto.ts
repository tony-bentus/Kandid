import { ApiProperty } from '@nestjs/swagger';

/**
 * Contagem dos 11 status na ordem do enum. As chaves existem mesmo com zero
 * para que o gráfico do cliente não precise tratar chave ausente.
 */
export class CountsByStatusDto {
  @ApiProperty({ example: 6 })
  SAVED: number;

  @ApiProperty({ example: 3 })
  APPLIED: number;

  @ApiProperty({ example: 4 })
  SCREENING: number;

  @ApiProperty({ example: 1 })
  SCHEDULED: number;

  @ApiProperty({ example: 3 })
  INTERVIEW: number;

  @ApiProperty({ example: 2 })
  OFFER: number;

  @ApiProperty({ example: 1 })
  HIRED: number;

  @ApiProperty({ example: 2 })
  REJECTED: number;

  @ApiProperty({ example: 1 })
  WITHDRAWN: number;

  @ApiProperty({ example: 0 })
  CANCELLED: number;

  @ApiProperty({ example: 1 })
  GHOSTED: number;
}
