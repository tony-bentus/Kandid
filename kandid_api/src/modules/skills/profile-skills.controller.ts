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
  PROFILE_SKILL_REQUEST_EXAMPLE,
  PROFILE_SKILL_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateProfileSkillDto } from './dto/create-profile-skill.dto.js';
import { ProfileSkillResponseDto } from './dto/profile-skill-response.dto.js';
import { UpdateProfileSkillDto } from './dto/update-profile-skill.dto.js';
import { SkillsService } from './skills.service.js';

/**
 * Skills vinculadas ao perfil do usuário autenticado (`/v1/me/skills`).
 */
@ApiTags('profile-skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/skills')
export class ProfileSkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as skills do perfil do usuário autenticado' })
  @ApiOkResponse({
    type: [ProfileSkillResponseDto],
    example: [PROFILE_SKILL_RESPONSE_EXAMPLE],
  })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfileSkillResponseDto[]> {
    return this.skillsService.listProfileSkills(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Vincula uma skill do catálogo ao perfil' })
  @ApiBody({
    type: CreateProfileSkillDto,
    examples: {
      default: { value: PROFILE_SKILL_REQUEST_EXAMPLE },
    },
  })
  @ApiCreatedResponse({
    type: ProfileSkillResponseDto,
    example: PROFILE_SKILL_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'Skill já vinculada ao perfil' })
  @ApiNotFoundResponse({ description: 'Skill não encontrada no catálogo' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProfileSkillDto,
  ): Promise<ProfileSkillResponseDto> {
    return this.skillsService.addProfileSkill(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza o nível/dados de uma skill do perfil' })
  @ApiBody({
    type: UpdateProfileSkillDto,
    examples: {
      default: { value: PROFILE_SKILL_REQUEST_EXAMPLE },
    },
  })
  @ApiOkResponse({
    type: ProfileSkillResponseDto,
    example: PROFILE_SKILL_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Vínculo não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileSkillDto,
  ): Promise<ProfileSkillResponseDto> {
    return this.skillsService.updateProfileSkill(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove o vínculo de uma skill do perfil' })
  @ApiNoContentResponse({ description: 'Vínculo removido' })
  @ApiNotFoundResponse({ description: 'Vínculo não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.skillsService.removeProfileSkill(user.userId, id);
  }
}
