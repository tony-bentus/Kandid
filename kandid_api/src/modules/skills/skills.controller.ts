import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  SKILL_RESPONSE_EXAMPLE,
  SKILL_SEARCH_EXAMPLE,
} from '../../common/swagger/examples.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SearchSkillsQueryDto } from './dto/search-skills-query.dto.js';
import { SkillResponseDto } from './dto/skill-response.dto.js';
import { SkillsService } from './skills.service.js';

/**
 * Catálogo global de skills (`/v1/skills`). Somente leitura.
 */
@ApiTags('skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca skills do catálogo global por nome ou alias',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Trecho do nome ou alias da skill',
    maxLength: 80,
    example: SKILL_SEARCH_EXAMPLE.q,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Máximo de resultados (1–50, padrão 20)',
    minimum: 1,
    maximum: 50,
    example: SKILL_SEARCH_EXAMPLE.limit,
  })
  @ApiOkResponse({
    type: [SkillResponseDto],
    example: [SKILL_RESPONSE_EXAMPLE],
  })
  @ApiBadRequestResponse({ description: 'Query inválida' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  search(@Query() query: SearchSkillsQueryDto): Promise<SkillResponseDto[]> {
    return this.skillsService.search(query);
  }
}
