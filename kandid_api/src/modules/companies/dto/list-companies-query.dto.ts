import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CompanyKind } from '../../../common/enums/company-kind.enum.js';

/** Filtro opcional de `GET /v1/companies`. */
export class ListCompaniesQueryDto {
  @ApiPropertyOptional({
    enum: CompanyKind,
    example: CompanyKind.AGENCY,
    description: 'Tipo de empresa (CLIENT | AGENCY | OTHER)',
  })
  @IsOptional()
  @IsEnum(CompanyKind)
  kind?: CompanyKind;
}
