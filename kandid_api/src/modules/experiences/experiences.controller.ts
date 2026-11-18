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
  BULLET_REQUEST_EXAMPLE,
  BULLET_RESPONSE_EXAMPLE,
  EXPERIENCE_REQUEST_EXAMPLE,
  EXPERIENCE_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateExperienceBulletDto } from './dto/create-experience-bullet.dto.js';
import { CreateExperienceDto } from './dto/create-experience.dto.js';
import { ExperienceBulletResponseDto } from './dto/experience-bullet-response.dto.js';
import { ExperienceResponseDto } from './dto/experience-response.dto.js';
import { UpdateExperienceBulletDto } from './dto/update-experience-bullet.dto.js';
import { UpdateExperienceDto } from './dto/update-experience.dto.js';
import { ExperiencesService } from './experiences.service.js';

/**
 * Experiências profissionais do usuário autenticado (`/v1/me/experiences`).
 * Inclui as rotas aninhadas de bullets.
 */
@ApiTags('experiences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/experiences')
export class ExperiencesController {
  constructor(private readonly experiencesService: ExperiencesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma experiência profissional' })
  @ApiBody({
    type: CreateExperienceDto,
    examples: { default: { value: EXPERIENCE_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: ExperienceResponseDto,
    example: EXPERIENCE_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    return this.experiencesService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as experiências do usuário autenticado' })
  @ApiOkResponse({ type: [ExperienceResponseDto] })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExperienceResponseDto[]> {
    return this.experiencesService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma experiência do usuário autenticado' })
  @ApiOkResponse({ type: ExperienceResponseDto })
  @ApiNotFoundResponse({ description: 'Experiência não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExperienceResponseDto> {
    return this.experiencesService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente uma experiência' })
  @ApiBody({
    type: UpdateExperienceDto,
    examples: { default: { value: EXPERIENCE_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ExperienceResponseDto,
    example: EXPERIENCE_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Experiência não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    return this.experiencesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma experiência e suas bullets' })
  @ApiNoContentResponse({ description: 'Experiência removida' })
  @ApiNotFoundResponse({ description: 'Experiência não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.experiencesService.remove(user.userId, id);
  }

  @Post(':id/bullets')
  @ApiOperation({ summary: 'Adiciona uma bullet a uma experiência' })
  @ApiBody({
    type: CreateExperienceBulletDto,
    examples: { default: { value: BULLET_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: ExperienceBulletResponseDto,
    example: BULLET_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Experiência não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  addBullet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateExperienceBulletDto,
  ): Promise<ExperienceBulletResponseDto> {
    return this.experiencesService.addBullet(user.userId, id, dto);
  }

  @Patch(':id/bullets/:bulletId')
  @ApiOperation({ summary: 'Atualiza parcialmente uma bullet' })
  @ApiBody({
    type: UpdateExperienceBulletDto,
    examples: { default: { value: BULLET_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ExperienceBulletResponseDto,
    example: BULLET_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Experiência ou bullet não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  updateBullet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bulletId', ParseUUIDPipe) bulletId: string,
    @Body() dto: UpdateExperienceBulletDto,
  ): Promise<ExperienceBulletResponseDto> {
    return this.experiencesService.updateBullet(
      user.userId,
      id,
      bulletId,
      dto,
    );
  }

  @Delete(':id/bullets/:bulletId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma bullet de uma experiência' })
  @ApiNoContentResponse({ description: 'Bullet removida' })
  @ApiNotFoundResponse({ description: 'Experiência ou bullet não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  removeBullet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('bulletId', ParseUUIDPipe) bulletId: string,
  ): Promise<void> {
    return this.experiencesService.removeBullet(user.userId, id, bulletId);
  }
}
