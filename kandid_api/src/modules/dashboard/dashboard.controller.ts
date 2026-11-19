import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardCompensationResponseDto } from './dto/dashboard-compensation-response.dto.js';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto.js';
import {
  DASHBOARD_COMPENSATION_EXAMPLE,
  DASHBOARD_SUMMARY_EXAMPLE,
} from './dashboard.swagger-examples.js';
import { assertNoQueryParams } from './query-params.js';

/** Leituras agregadas do funil e da compensação do usuário autenticado. */
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo agregado do funil de candidaturas do usuário autenticado',
    description: 'Somente leitura; nenhum query parameter é aceito.',
  })
  @ApiOkResponse({
    type: DashboardSummaryResponseDto,
    example: DASHBOARD_SUMMARY_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Query parameter não suportado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DashboardSummaryResponseDto> {
    assertNoQueryParams(request.query as Record<string, unknown>);
    return this.dashboardService.summary(user.userId);
  }

  @Get('compensation')
  @ApiOperation({
    summary: 'Comparativo de compensação proposta × ofertada por bucket',
    description:
      'Agrupado por (currency, salaryPeriod), senioridade e skill; nenhum query parameter é aceito.',
  })
  @ApiOkResponse({
    type: DashboardCompensationResponseDto,
    example: DASHBOARD_COMPENSATION_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'Query parameter não suportado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  compensation(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DashboardCompensationResponseDto> {
    assertNoQueryParams(request.query as Record<string, unknown>);
    return this.dashboardService.compensation(user.userId);
  }
}
