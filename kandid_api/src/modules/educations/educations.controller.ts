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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  EDUCATION_REQUEST_EXAMPLE,
  EDUCATION_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateEducationDto } from './dto/create-education.dto.js';
import { EducationResponseDto } from './dto/education-response.dto.js';
import { UpdateEducationDto } from './dto/update-education.dto.js';
import { EducationsService } from './educations.service.js';

/** Formação acadêmica do usuário autenticado (`/v1/me/educations`). */
@ApiTags('educations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/educations')
export class EducationsController {
  constructor(private readonly educationsService: EducationsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma formação acadêmica' })
  @ApiBody({
    type: CreateEducationDto,
    examples: { default: { value: EDUCATION_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: EducationResponseDto,
    example: EDUCATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEducationDto,
  ): Promise<EducationResponseDto> {
    return this.educationsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as formações do usuário autenticado' })
  @ApiOkResponse({
    type: [EducationResponseDto],
    example: [EDUCATION_RESPONSE_EXAMPLE],
  })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EducationResponseDto[]> {
    return this.educationsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma formação do usuário autenticado' })
  @ApiOkResponse({
    type: EducationResponseDto,
    example: EDUCATION_RESPONSE_EXAMPLE,
  })
  @ApiNotFoundResponse({ description: 'Formação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EducationResponseDto> {
    return this.educationsService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente uma formação' })
  @ApiOkResponse({
    type: EducationResponseDto,
    example: EDUCATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Formação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEducationDto,
  ): Promise<EducationResponseDto> {
    return this.educationsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma formação' })
  @ApiNoContentResponse({ description: 'Formação removida' })
  @ApiNotFoundResponse({ description: 'Formação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.educationsService.remove(user.userId, id);
  }
}
