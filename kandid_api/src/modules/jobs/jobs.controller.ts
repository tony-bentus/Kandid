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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  JOB_LIST_EXAMPLE,
  JOB_REQUEST_EXAMPLE,
  JOB_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { JobResponseDto } from './dto/job-response.dto.js';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto.js';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

/** Vagas do usuário autenticado (`/v1/jobs`). */
@ApiTags('jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma vaga com stack e faixa salarial' })
  @ApiBody({
    type: CreateJobDto,
    examples: { default: { value: JOB_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: JobResponseDto,
    example: JOB_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({
    description: 'Empresa, recrutador ou skill não encontrado',
  })
  @ApiConflictResponse({ description: 'Skill já vinculada à vaga' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista vagas com filtros e paginação (companyId, seniority, skillId, q, page, limit)',
  })
  @ApiOkResponse({
    type: PaginatedJobsResponseDto,
    example: JOB_LIST_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'Query inválida (inclui status e sort, que não são aceitos nesta sprint)',
  })
  @ApiNotFoundResponse({ description: 'Skill inexistente no catálogo' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListJobsQueryDto,
  ): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma vaga do usuário autenticado' })
  @ApiOkResponse({
    type: JobResponseDto,
    example: JOB_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Vaga não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente uma vaga' })
  @ApiBody({
    type: UpdateJobDto,
    examples: { default: { value: JOB_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: JobResponseDto,
    example: JOB_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido ou ID inválido' })
  @ApiNotFoundResponse({
    description: 'Vaga, empresa, recrutador ou skill não encontrado',
  })
  @ApiConflictResponse({ description: 'Skill já vinculada à vaga' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma vaga' })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNoContentResponse({ description: 'Vaga removida' })
  @ApiNotFoundResponse({ description: 'Vaga não encontrada' })
  @ApiConflictResponse({
    description:
      'Cannot delete job with applications | Cannot delete job with ATS analyses',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.jobsService.remove(user.userId, id);
  }
}
