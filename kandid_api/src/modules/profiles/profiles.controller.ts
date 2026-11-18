import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  PROFILE_REQUEST_EXAMPLE,
  PROFILE_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfilesService } from './profiles.service.js';

/**
 * Rotas do perfil do usuário autenticado (`/v1/me/profile`).
 *
 * O `userId` vem do JWT via `@CurrentUser()`. Não existe `user_id` no body.
 */
@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/profile')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna o perfil do usuário autenticado' })
  @ApiOkResponse({
    type: ProfileResponseDto,
    example: PROFILE_RESPONSE_EXAMPLE,
  })
  @ApiNotFoundResponse({ description: 'Perfil ainda não criado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.getProfile(user.userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Cria ou atualiza parcialmente o perfil do usuário autenticado',
  })
  @ApiBody({
    type: UpdateProfileDto,
    examples: { default: { value: PROFILE_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: ProfileResponseDto,
    example: PROFILE_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.updateProfile(user.userId, dto);
  }
}
