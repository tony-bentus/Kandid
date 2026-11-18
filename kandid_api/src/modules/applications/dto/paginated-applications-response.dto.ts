import { ApiProperty } from '@nestjs/swagger';
import { ApplicationResponseDto } from './application-response.dto.js';

/** Metadados do envelope de listagem de candidaturas. */
export class PaginatedApplicationsMetaDto {
  @ApiProperty({ example: 1, minimum: 1 })
  page: number;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  limit: number;

  @ApiProperty({ example: 1, minimum: 0 })
  total: number;

  @ApiProperty({
    description: 'total / limit arredondado para cima; 0 quando total é 0',
    example: 1,
    minimum: 0,
  })
  totalPages: number;
}

/** Envelope de `GET /v1/applications`. Página além do fim retorna `data: []`. */
export class PaginatedApplicationsResponseDto {
  @ApiProperty({ type: [ApplicationResponseDto] })
  data: ApplicationResponseDto[];

  @ApiProperty({ type: PaginatedApplicationsMetaDto })
  meta: PaginatedApplicationsMetaDto;
}
