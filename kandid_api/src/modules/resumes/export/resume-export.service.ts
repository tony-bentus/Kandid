import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AtsAnalysis } from '../../ats/entities/ats-analysis.entity.js';
import type { ResumeExportFormat } from '../dto/export-resume-version-query.dto.js';
import { ResumeExportResponseDto } from '../dto/resume-export-response.dto.js';
import { ResumeVersion } from '../entities/resume-version.entity.js';
import { renderResumeHtml } from './render-resume-html.js';

/** Resultado discriminado: o controller escolhe o Content-Type por `format`. */
export type ResumeExportResult =
  | { format: 'json'; body: ResumeExportResponseDto }
  | { format: 'html'; body: string };

/**
 * Export somente leitura de versões imutáveis (KAN-50/KAN-51).
 *
 * Ownership é resolvido por join em `resumes.user_id`; versão alheia ou
 * inexistente responde `404 Resume version not found`. Nenhuma escrita ocorre:
 * nem `resume_versions`, nem `ats_analyses` são alteradas. O HTML não consulta
 * analyses — o score nunca aparece no documento.
 */
@Injectable()
export class ResumeExportService {
  constructor(
    @InjectRepository(ResumeVersion)
    private readonly versionsRepository: Repository<ResumeVersion>,
    @InjectRepository(AtsAnalysis)
    private readonly analysesRepository: Repository<AtsAnalysis>,
  ) {}

  async export(
    userId: string,
    versionId: string,
    format: ResumeExportFormat,
  ): Promise<ResumeExportResult> {
    const version = await this.requireVersion(userId, versionId);

    if (format === 'html') {
      return {
        format,
        body: renderResumeHtml({ snapshot: version.contentSnapshot }),
      };
    }

    const latest = await this.analysesRepository.findOne({
      where: { resumeVersionId: version.id },
      order: { createdAt: 'DESC', id: 'ASC' },
    });

    const body: ResumeExportResponseDto = {
      resumeId: version.resumeId,
      version: version.version,
      // Nunca ler resume_version.ats_score: a coluna permanece null.
      atsScore: latest?.score ?? null,
      contentSnapshot: version.contentSnapshot,
    };

    return { format, body };
  }

  private async requireVersion(
    userId: string,
    id: string,
  ): Promise<ResumeVersion> {
    const version = await this.versionsRepository
      .createQueryBuilder('resumeVersion')
      .innerJoin('resumeVersion.resume', 'resume')
      .where('resumeVersion.id = :id', { id })
      .andWhere('resume.userId = :userId', { userId })
      .getOne();

    if (version === null) {
      throw new NotFoundException('Resume version not found');
    }

    return version;
  }
}
