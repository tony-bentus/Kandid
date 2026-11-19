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
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CreateResumeDto } from './dto/create-resume.dto.js';
import { CreateResumeVersionDto } from './dto/create-resume-version.dto.js';
import { PaginatedResumesResponseDto } from './dto/paginated-resumes-response.dto.js';
import { QueryResumeDto } from './dto/query-resume.dto.js';
import { ResumeResponseDto } from './dto/resume-response.dto.js';
import { ResumeVersionResponseDto } from './dto/resume-version-response.dto.js';
import { UpdateResumeDto } from './dto/update-resume.dto.js';
import { ResumesService } from './resumes.service.js';
import {
  RESUME_LIST_EXAMPLE,
  RESUME_REQUEST_EXAMPLE,
  RESUME_RESPONSE_EXAMPLE,
  RESUME_VERSION_REQUEST_EXAMPLE,
  RESUME_VERSION_RESPONSE_EXAMPLE,
} from './swagger-examples.js';

/** CRUD de currículos e geração de versões (`/v1/resumes`). */
@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um currículo do usuário autenticado' })
  @ApiBody({
    type: CreateResumeDto,
    examples: { default: { value: RESUME_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: ResumeResponseDto,
    example: RESUME_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido ou campo fora da whitelist',
  })
  @ApiConflictResponse({
    description: 'Resume name already exists for this user',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateResumeDto,
  ): Promise<ResumeResponseDto> {
    return this.resumesService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista currículos do usuário com paginação (createdAt DESC, id ASC)',
  })
  @ApiQuery({ type: QueryResumeDto })
  @ApiOkResponse({
    type: PaginatedResumesResponseDto,
    example: RESUME_LIST_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Query inválida (inclui sort, que não é aceito nesta sprint)',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryResumeDto,
  ): Promise<PaginatedResumesResponseDto> {
    return this.resumesService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um currículo do usuário autenticado' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: ResumeResponseDto,
    example: RESUME_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Currículo não encontrado' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumeResponseDto> {
    return this.resumesService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Atualiza nome, cargo alvo e/ou default de um currículo',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    type: UpdateResumeDto,
    examples: { default: { value: RESUME_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ResumeResponseDto,
    example: RESUME_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido, null explícito ou campo fora da whitelist',
  })
  @ApiNotFoundResponse({ description: 'Currículo não encontrado' })
  @ApiConflictResponse({
    description: 'Resume name already exists for this user',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResumeDto,
  ): Promise<ResumeResponseDto> {
    return this.resumesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui um currículo sem versões vinculadas',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Currículo excluído' })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Currículo não encontrado' })
  @ApiConflictResponse({
    description: 'Resume has versions and cannot be deleted',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.resumesService.remove(user.userId, id);
  }

  @Post(':id/versions')
  @ApiOperation({
    summary: 'Gera uma versão imutável do currículo a partir do perfil',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    type: CreateResumeVersionDto,
    required: false,
    examples: { default: { value: RESUME_VERSION_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: ResumeVersionResponseDto,
    example: RESUME_VERSION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido, perfil ausente ou campo fora da whitelist',
  })
  @ApiNotFoundResponse({
    description: 'Currículo ou vaga do usuário não encontrados',
  })
  @ApiConflictResponse({ description: 'Version already generated' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  generateVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateResumeVersionDto,
  ): Promise<ResumeVersionResponseDto> {
    return this.resumesService.generateVersion(user.userId, id, dto);
  }
}

/** Leitura de versões imutáveis (`/v1/resume-versions`). */
@ApiTags('resume-versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resume-versions')
export class ResumeVersionsController {
  constructor(private readonly resumesService: ResumesService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Retorna uma versão imutável do currículo do usuário',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: ResumeVersionResponseDto,
    example: RESUME_VERSION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Versão de currículo não encontrada' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumeVersionResponseDto> {
    return this.resumesService.findVersion(user.userId, id);
  }
}
