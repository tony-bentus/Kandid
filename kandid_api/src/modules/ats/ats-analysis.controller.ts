import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AnalyzeResumeVersionDto } from './dto/analyze-resume-version.dto.js';
import { AtsAnalysisResponseDto } from './dto/ats-analysis-response.dto.js';
import { AtsAnalysisService } from './ats-analysis.service.js';

const ANALYZE_REQUEST_EXAMPLE: Record<string, unknown> = {
  jobId: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
};

const ATS_ANALYSIS_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '8f4b7c2d-3a1e-4f9b-8d6c-1a2b3c4d5e6f',
  resumeVersionId: '2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081',
  jobId: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
  score: 78,
  breakdown: [
    {
      dimension: 'requiredSkills',
      weight: 35,
      effectiveWeight: 35,
      earned: 28,
      applicable: true,
      matched: ['Node.js', 'TypeScript'],
      missing: ['Kubernetes'],
      detail: '2 de 3 skills obrigatórias encontradas',
    },
  ],
  checks: [
    { id: 'has-summary', passed: true, detail: null },
    {
      id: 'bullet-length',
      passed: false,
      detail: '2 bullets acima de 220 caracteres',
    },
  ],
  matchedKeywords: ['Node.js', 'TypeScript'],
  missingKeywords: ['Kubernetes'],
  createdAt: '2026-11-19T12:10:00.000Z',
};

const JOB_NOT_FOUND_EXAMPLE: Record<string, unknown> = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Job not found',
  path: '/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analyze',
  timestamp: '2026-11-18T12:05:00.000Z',
};

const RESUME_VERSION_NOT_FOUND_EXAMPLE: Record<string, unknown> = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Resume version not found',
  path: '/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analyze',
  timestamp: '2026-11-18T12:05:00.000Z',
};

const RESUME_VERSION_NOT_FOUND_ANALYSIS_EXAMPLE: Record<string, unknown> = {
  ...RESUME_VERSION_NOT_FOUND_EXAMPLE,
  path: '/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analysis',
};

const JOB_ID_MISMATCH_EXAMPLE: Record<string, unknown> = {
  statusCode: 400,
  error: 'Bad Request',
  message: 'jobId does not match the job of this resume version',
  path: '/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analyze',
  timestamp: '2026-11-18T12:10:00.000Z',
};

const NO_ANALYSIS_EXAMPLE: Record<string, unknown> = {
  statusCode: 404,
  error: 'Not Found',
  message: 'No analysis found for this resume version',
  path: '/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analysis',
  timestamp: '2026-11-18T12:15:00.000Z',
};

/** Análise ATS de versões imutáveis de currículo (`/v1/resume-versions`). */
@ApiTags('ats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resume-versions')
export class AtsAnalysisController {
  constructor(private readonly atsAnalysisService: AtsAnalysisService) {}

  @Post(':id/analyze')
  @ApiOperation({
    summary: 'Analisa uma versão de currículo contra uma vaga do usuário',
  })
  @ApiBody({
    type: AnalyzeResumeVersionDto,
    examples: { default: { value: ANALYZE_REQUEST_EXAMPLE } },
  })
  @ApiCreatedResponse({
    type: AtsAnalysisResponseDto,
    example: ATS_ANALYSIS_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description:
      'jobId inválido, fora da whitelist ou divergente da vaga da versão',
    examples: {
      jobIdMismatch: {
        summary: 'Versão vinculada a outra vaga',
        value: JOB_ID_MISMATCH_EXAMPLE,
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Versão ou vaga não encontrada',
    examples: {
      resumeVersion: {
        summary: 'Versão alheia ou inexistente',
        value: RESUME_VERSION_NOT_FOUND_EXAMPLE,
      },
      job: {
        summary: 'Vaga alheia ou inexistente',
        value: JOB_NOT_FOUND_EXAMPLE,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnalyzeResumeVersionDto,
  ): Promise<AtsAnalysisResponseDto> {
    return this.atsAnalysisService.analyze(user.userId, id, dto);
  }

  @Get(':id/analysis')
  @ApiOperation({
    summary: 'Retorna a análise ATS mais recente da versão de currículo',
  })
  @ApiOkResponse({
    type: AtsAnalysisResponseDto,
    example: ATS_ANALYSIS_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ description: 'ID inválido' })
  @ApiNotFoundResponse({
    description: 'Versão não encontrada ou versão sem análise',
    examples: {
      resumeVersion: {
        summary: 'Versão alheia ou inexistente',
        value: RESUME_VERSION_NOT_FOUND_ANALYSIS_EXAMPLE,
      },
      noAnalysis: {
        summary: 'Versão ainda sem análise',
        value: NO_ANALYSIS_EXAMPLE,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  findLatest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AtsAnalysisResponseDto> {
    return this.atsAnalysisService.findLatest(user.userId, id);
  }
}
