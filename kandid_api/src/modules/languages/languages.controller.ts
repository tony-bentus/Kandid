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
  LANGUAGE_REQUEST_EXAMPLE,
  LANGUAGE_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateLanguageDto } from './dto/create-language.dto.js';
import { LanguageResponseDto } from './dto/language-response.dto.js';
import { UpdateLanguageDto } from './dto/update-language.dto.js';
import { LanguagesService } from './languages.service.js';

/** Idiomas do usuário autenticado (`/v1/me/languages`). */
@ApiTags('languages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um idioma no perfil' })
  @ApiBody({
    type: CreateLanguageDto,
    examples: { default: { value: LANGUAGE_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: LanguageResponseDto,
    example: LANGUAGE_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'Idioma já cadastrado no perfil' })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLanguageDto,
  ): Promise<LanguageResponseDto> {
    return this.languagesService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os idiomas do usuário autenticado' })
  @ApiOkResponse({
    type: [LanguageResponseDto],
    example: [LANGUAGE_RESPONSE_EXAMPLE],
  })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LanguageResponseDto[]> {
    return this.languagesService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um idioma do usuário autenticado' })
  @ApiOkResponse({
    type: LanguageResponseDto,
    example: LANGUAGE_RESPONSE_EXAMPLE,
  })
  @ApiNotFoundResponse({ description: 'Idioma não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LanguageResponseDto> {
    return this.languagesService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente um idioma' })
  @ApiOkResponse({
    type: LanguageResponseDto,
    example: LANGUAGE_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'Idioma já cadastrado no perfil' })
  @ApiNotFoundResponse({ description: 'Idioma não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLanguageDto,
  ): Promise<LanguageResponseDto> {
    return this.languagesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um idioma' })
  @ApiNoContentResponse({ description: 'Idioma removido' })
  @ApiNotFoundResponse({ description: 'Idioma não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.languagesService.remove(user.userId, id);
  }
}
