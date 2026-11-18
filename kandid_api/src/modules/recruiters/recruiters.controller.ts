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
  RECRUITER_REQUEST_EXAMPLE,
  RECRUITER_RESPONSE_EXAMPLE,
} from '../../common/swagger/examples.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CreateRecruiterDto } from './dto/create-recruiter.dto.js';
import { RecruiterResponseDto } from './dto/recruiter-response.dto.js';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto.js';
import { RecruitersService } from './recruiters.service.js';

/** Recrutadores do usuário autenticado (`/v1/recruiters`). */
@ApiTags('recruiters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recruiters')
export class RecruitersController {
  constructor(private readonly recruitersService: RecruitersService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um recrutador' })
  @ApiBody({
    type: CreateRecruiterDto,
    examples: { default: { value: RECRUITER_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: RecruiterResponseDto,
    example: RECRUITER_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({ description: 'Empresa-agência não encontrada' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecruiterDto,
  ): Promise<RecruiterResponseDto> {
    return this.recruitersService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os recrutadores do usuário autenticado' })
  @ApiOkResponse({
    type: [RecruiterResponseDto],
    example: [RECRUITER_RESPONSE_EXAMPLE],
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecruiterResponseDto[]> {
    return this.recruitersService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna um recrutador do usuário autenticado' })
  @ApiOkResponse({
    type: RecruiterResponseDto,
    example: RECRUITER_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Recrutador não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RecruiterResponseDto> {
    return this.recruitersService.findOne(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza parcialmente um recrutador' })
  @ApiBody({
    type: UpdateRecruiterDto,
    examples: { default: { value: RECRUITER_REQUEST_EXAMPLE } },
  })
  @ApiOkResponse({
    type: RecruiterResponseDto,
    example: RECRUITER_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiNotFoundResponse({
    description: 'Recrutador ou empresa-agência não encontrado',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecruiterDto,
  ): Promise<RecruiterResponseDto> {
    return this.recruitersService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um recrutador' })
  @ApiNoContentResponse({ description: 'Recrutador removido' })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({ description: 'Recrutador não encontrado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.recruitersService.remove(user.userId, id);
  }
}
