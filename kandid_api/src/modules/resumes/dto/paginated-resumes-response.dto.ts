import { ApiProperty } from '@nestjs/swagger';
import { ResumeResponseDto } from './resume-response.dto.js';

/** Metadados do envelope de listagem de currículos. */
export class PaginatedResumesMetaDto {
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

/** Envelope de `GET /v1/resumes`. Página além do fim retorna `data: []`. */
export class PaginatedResumesResponseDto {
  @ApiProperty({ type: [ResumeResponseDto] })
  data: ResumeResponseDto[];

  @ApiProperty({ type: PaginatedResumesMetaDto })
  meta: PaginatedResumesMetaDto;
}
