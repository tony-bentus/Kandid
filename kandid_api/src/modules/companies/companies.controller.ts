import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  COMPANY_REQUEST_EXAMPLE,
  COMPANY_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import { CompanyKind } from '../../common/enums/company-kind.enum.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CompaniesService } from './companies.service.js';
import { CompanyResponseDto } from './dto/company-response.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

/** Empresas do usuário autenticado (`/v1/companies`). */
@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma empresa' })
  @ApiBody({
    type: CreateCompanyDto,
    examples: { default: { value: COMPANY_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: CompanyResponseDto,
    example: COMPANY_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'Nome de empresa já existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as empresas do usuário autenticado' })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: CompanyKind,
    description: 'Filtra por tipo de empresa',
    example: CompanyKind.AGENCY,
  })
  @ApiOkResponse({
    type: [CompanyResponseDto],
    example: [COMPANY_RESPONSE_EXAMPLE],
  })
  @ApiBadRequestResponse({ description: 'Filtro inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCompaniesQueryDto,
  ): Promise<CompanyResponseDto[]> {
    return this.companiesService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma empresa do usuário autenticado' })
  @ApiOkResponse({
    type: CompanyResponseDto,
    example: COMPANY_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Empresa não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente uma empresa' })
  @ApiBody({
    type: UpdateCompanyDto,
    examples: { default: { value: COMPANY_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: CompanyResponseDto,
    example: COMPANY_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Empresa não encontrada' })
  @ApiConflictResponse({ description: 'Nome de empresa já existe' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return this.companiesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma empresa' })
  @ApiNoContentResponse({ description: 'Empresa removida' })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Empresa não encontrada' })
  @ApiConflictResponse({ description: 'Empresa possui vagas vinculadas' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.companiesService.remove(user.userId, id);
  }
}
