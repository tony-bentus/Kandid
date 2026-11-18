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
  CERTIFICATION_REQUEST_EXAMPLE,
  CERTIFICATION_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CertificationResponseDto } from './dto/certification-response.dto.js';
import { CreateCertificationDto } from './dto/create-certification.dto.js';
import { UpdateCertificationDto } from './dto/update-certification.dto.js';
import { CertificationsService } from './certifications.service.js';

/** Certificações do usuário autenticado (`/v1/me/certifications`). */
@ApiTags('certifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/certifications')
export class CertificationsController {
  constructor(
    private readonly certificationsService: CertificationsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma certificação' })
  @ApiBody({
    type: CreateCertificationDto,
    examples: { default: { value: CERTIFICATION_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: CertificationResponseDto,
    example: CERTIFICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCertificationDto,
  ): Promise<CertificationResponseDto> {
    return this.certificationsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as certificações do usuário autenticado' })
  @ApiOkResponse({
    type: [CertificationResponseDto],
    example: [CERTIFICATION_RESPONSE_EXAMPLE],
  })
  @ApiNotFoundResponse({ description: 'Perfil não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CertificationResponseDto[]> {
    return this.certificationsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma certificação do usuário autenticado' })
  @ApiOkResponse({
    type: CertificationResponseDto,
    example: CERTIFICATION_RESPONSE_EXAMPLE,
  })
  @ApiNotFoundResponse({ description: 'Certificação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CertificationResponseDto> {
    return this.certificationsService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente uma certificação' })
  @ApiOkResponse({
    type: CertificationResponseDto,
    example: CERTIFICATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Certificação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificationDto,
  ): Promise<CertificationResponseDto> {
    return this.certificationsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove uma certificação' })
  @ApiNoContentResponse({ description: 'Certificação removida' })
  @ApiNotFoundResponse({ description: 'Certificação não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.certificationsService.remove(user.userId, id);
  }
}
