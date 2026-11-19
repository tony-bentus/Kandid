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
  Req,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { assertNoQueryParams } from '../../common/utils/assert-no-query-params.js';
import { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewResponseDto } from './dto/interview-response.dto.js';
import { UpdateInterviewDto } from './dto/update-interview.dto.js';
import { InterviewsService } from './interviews.service.js';
import {
  INTERVIEW_LIST_EXAMPLE,
  INTERVIEW_REQUEST_EXAMPLE,
  INTERVIEW_RESPONSE_EXAMPLE,
  INTERVIEW_UPDATE_EXAMPLE,
} from './swagger-examples.js';

/** CRUD de entrevistas aninhado em candidaturas (`/v1/applications/:id/interviews`). */
@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications/:id/interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Agenda uma entrevista para uma candidatura do usuário' })
  @ApiParam({ name: 'id', description: 'ID da candidatura', format: 'uuid' })
  @ApiBody({
    type: CreateInterviewDto,
    examples: { default: { value: INTERVIEW_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: InterviewResponseDto,
    example: INTERVIEW_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido ou campo fora da whitelist',
  })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiConflictResponse({
    description: 'Interview round already exists for this application',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInterviewDto,
  ): Promise<InterviewResponseDto> {
    return this.interviewsService.create(user.userId, id, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista as entrevistas da candidatura (round ASC, scheduledAt ASC, id ASC)',
  })
  @ApiParam({ name: 'id', description: 'ID da candidatura', format: 'uuid' })
  @ApiOkResponse({ type: [InterviewResponseDto], example: INTERVIEW_LIST_EXAMPLE })
  @ApiBadRequestResponse({
    description: 'ID inválido ou query parameter não suportado',
  })
  @ApiNotFoundResponse({ description: 'Application not found' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<InterviewResponseDto[]> {
    assertNoQueryParams(request.query as Record<string, unknown>);
    return this.interviewsService.findAll(user.userId, id);
  }

  @Get(':interviewId')
  @ApiOperation({ summary: 'Retorna uma entrevista da candidatura do usuário' })
  @ApiParam({ name: 'id', description: 'ID da candidatura', format: 'uuid' })
  @ApiParam({ name: 'interviewId', description: 'ID da entrevista', format: 'uuid' })
  @ApiOkResponse({
    type: InterviewResponseDto,
    example: INTERVIEW_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Application ou Interview not found' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
  ): Promise<InterviewResponseDto> {
    return this.interviewsService.findOne(user.userId, id, interviewId);
  }

  @Patch(':interviewId')
  @ApiOperation({
    summary: 'Atualiza parcialmente uma entrevista (body vazio é no-op)',
  })
  @ApiParam({ name: 'id', description: 'ID da candidatura', format: 'uuid' })
  @ApiParam({ name: 'interviewId', description: 'ID da entrevista', format: 'uuid' })
  @ApiBody({
    type: UpdateInterviewDto,
    examples: { default: { value: INTERVIEW_UPDATE_EXAMPLE } },
  })
  @ApiOkResponse({
    type: InterviewResponseDto,
    example: INTERVIEW_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido, null em campo obrigatório ou campo fora da whitelist',
  })
  @ApiNotFoundResponse({ description: 'Application ou Interview not found' })
  @ApiConflictResponse({
    description: 'Interview round already exists for this application',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @Body() dto: UpdateInterviewDto,
  ): Promise<InterviewResponseDto> {
    return this.interviewsService.update(user.userId, id, interviewId, dto);
  }

  @Delete(':interviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui fisicamente uma entrevista' })
  @ApiParam({ name: 'id', description: 'ID da candidatura', format: 'uuid' })
  @ApiParam({ name: 'interviewId', description: 'ID da entrevista', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Entrevista excluída' })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Application ou Interview not found' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
  ): Promise<void> {
    return this.interviewsService.remove(user.userId, id, interviewId);
  }
}
