import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import {
  APPLICATION_COMPENSATION_REQUEST_EXAMPLE,
  APPLICATION_LIST_EXAMPLE,
  APPLICATION_REQUEST_EXAMPLE,
  APPLICATION_RESPONSE_EXAMPLE,
  APPLICATION_STATUS_HISTORY_EXAMPLE,
  APPLICATION_STATUS_REQUEST_EXAMPLE,
} from '../../common/swagger/examples.js';
import { ApplicationsService } from './applications.service.js';
import { ApplicationResponseDto } from './dto/application-response.dto.js';
import { ApplicationStatusHistoryResponseDto } from './dto/application-status-history-response.dto.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto.js';
import { PaginatedApplicationsResponseDto } from './dto/paginated-applications-response.dto.js';
import { UpdateApplicationCompensationDto } from './dto/update-application-compensation.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

/** Criação de candidatura a partir de uma vaga do usuário (`/v1/jobs`). */
@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs/:id/applications')
export class JobApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma candidatura para uma vaga do usuário' })
  @ApiBody({
    type: CreateApplicationDto,
    examples: { default: { value: APPLICATION_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: ApplicationResponseDto,
    example: APPLICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido ou campo fora da whitelist' })
  @ApiNotFoundResponse({ description: 'Vaga não encontrada para este usuário' })
  @ApiConflictResponse({
    description: 'Application already exists for this job',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.create(user.userId, id, dto);
  }
}

/** Leitura, transições e compensação de candidaturas (`/v1/applications`). */
@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista candidaturas com filtros e paginação (status, companyId, from, to, page, limit)',
  })
  @ApiQuery({ type: ListApplicationsQueryDto })
  @ApiOkResponse({
    type: PaginatedApplicationsResponseDto,
    example: APPLICATION_LIST_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Query inválida (inclui sort, que não é aceito nesta sprint)',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponseDto> {
    return this.applicationsService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma candidatura do usuário autenticado' })
  @ApiOkResponse({
    type: ApplicationResponseDto,
    example: APPLICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Candidatura não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findOne(user.userId, id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Retorna o histórico append-only de status da candidatura',
  })
  @ApiOkResponse({
    type: [ApplicationStatusHistoryResponseDto],
    example: APPLICATION_STATUS_HISTORY_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Candidatura não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationStatusHistoryResponseDto[]> {
    return this.applicationsService.history(user.userId, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Transiciona o status e registra uma linha de histórico',
  })
  @ApiBody({
    type: UpdateApplicationStatusDto,
    examples: { default: { value: APPLICATION_STATUS_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ApplicationResponseDto,
    example: APPLICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Status inválido ou transição não permitida',
  })
  @ApiNotFoundResponse({ description: 'Candidatura não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.transition(user.userId, id, dto);
  }

  @Patch(':id/compensation')
  @ApiOperation({
    summary:
      'Atualiza compensação, benefícios e campos descritivos da candidatura',
  })
  @ApiBody({
    type: UpdateApplicationCompensationDto,
    examples: { default: { value: APPLICATION_COMPENSATION_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ApplicationResponseDto,
    example: APPLICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Candidatura não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  updateCompensation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationCompensationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.updateCompensation(user.userId, id, dto);
  }
}
