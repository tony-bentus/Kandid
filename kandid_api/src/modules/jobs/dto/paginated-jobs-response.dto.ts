import { ApiProperty } from '@nestjs/swagger';
import { JobResponseDto } from './job-response.dto.js';

/** Metadados do envelope de listagem de vagas. */
export class PaginatedJobsMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ example: 42, minimum: 0 })
  total: number;

  @ApiProperty({
    description: 'total / limit arredondado para cima; 0 quando total é 0',
    example: 3,
    minimum: 0,
  })
  totalPages: number;
}

/** Envelope de `GET /v1/jobs`. Página além do fim retorna `data: []`. */
export class PaginatedJobsResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  data: JobResponseDto[];

  @ApiProperty({ type: PaginatedJobsMetaDto })
  meta: PaginatedJobsMetaDto;
}
