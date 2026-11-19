import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { Job } from '../jobs/entities/job.entity.js';
import { ResumeVersion } from '../resumes/entities/resume-version.entity.js';
import { Skill } from '../skills/entities/skill.entity.js';
import { extractResume, parseJob, runChecks, score } from './engine/index.js';
import { AnalyzeResumeVersionDto } from './dto/analyze-resume-version.dto.js';
import { AtsAnalysisResponseDto } from './dto/ats-analysis-response.dto.js';
import { AtsAnalysis } from './entities/ats-analysis.entity.js';

/** Tipo canônico do snapshot, inferido da assinatura do motor. */
type ResumeSnapshotInput = Parameters<typeof extractResume>[0];

/**
 * Persistência e consulta de análises ATS.
 *
 * Ownership é sempre resolvido por join (`resume_versions → resumes.user_id`):
 * `ats_analyses` não tem `user_id` e nenhum DTO aceita `userId`. O motor é
 * executado fora da transação; dentro dela somente uma linha é inserida, sem
 * tocar `resume_version` (ADR 0005, decisões 10 e 11).
 */
@Injectable()
export class AtsAnalysisService {
  constructor(
    @InjectRepository(AtsAnalysis)
    private readonly analysesRepository: Repository<AtsAnalysis>,
    @InjectRepository(ResumeVersion)
    private readonly versionsRepository: Repository<ResumeVersion>,
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(Skill)
    private readonly skillsRepository: Repository<Skill>,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /v1/resume-versions/:id/analyze — sempre insere uma nova análise. */
  async analyze(
    userId: string,
    resumeVersionId: string,
    dto: AnalyzeResumeVersionDto,
  ): Promise<AtsAnalysisResponseDto> {
    const version = await this.requireVersion(userId, resumeVersionId);
    const job = await this.jobsRepository.findOne({
      where: { id: dto.jobId, userId },
    });

    if (job === null) {
      throw new NotFoundException('Job not found');
    }

    this.assertJobMatch(version.jobId, job.id);

    const skills = await this.skillsRepository.find({
      select: { id: true, name: true, aliases: true },
      order: { name: 'ASC', id: 'ASC' },
    });
    const catalog = skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      aliases: this.toStringArray(skill.aliases),
    }));
    const snapshot = this.toSnapshot(version.contentSnapshot);

    // Funções puras: nenhuma delas recebe manager, relógio ou I/O.
    const parsedJob = parseJob({
      description: job.description ?? '',
      skills: catalog,
    });
    const sections = extractResume(snapshot);
    const checks = runChecks(snapshot);
    const result = score({ job: parsedJob, sections, checks, snapshot });

    const saved = await this.dataSource.transaction(async (manager) => {
      // Revalidação sob a mesma transação da escrita: versão/vaga podem ter
      // sido removidas desde a leitura usada pelo motor.
      const versionInTransaction = await this.requireVersion(
        userId,
        resumeVersionId,
        manager,
      );
      this.assertJobMatch(versionInTransaction.jobId, job.id);

      const jobInTransaction = await manager
        .getRepository(Job)
        .findOne({ where: { id: job.id, userId } });
      if (jobInTransaction === null) {
        throw new NotFoundException('Job not found');
      }

      const repository = manager.getRepository(AtsAnalysis);
      const analysis = repository.create({
        resumeVersionId: versionInTransaction.id,
        jobId: jobInTransaction.id,
        score: result.score,
        breakdown: result.breakdown,
        checks,
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
      });

      return repository.save(analysis);
    });

    return this.toResponse(saved);
  }

  /** GET /v1/resume-versions/:id/analysis — última análise da versão. */
  async findLatest(
    userId: string,
    resumeVersionId: string,
  ): Promise<AtsAnalysisResponseDto> {
    await this.requireVersion(userId, resumeVersionId);

    const analysis = await this.analysesRepository.findOne({
      where: { resumeVersionId },
      order: { createdAt: 'DESC', id: 'ASC' },
    });

    if (analysis === null) {
      throw new NotFoundException('No analysis found for this resume version');
    }

    return this.toResponse(analysis);
  }

  private async requireVersion(
    userId: string,
    id: string,
    manager?: EntityManager,
  ): Promise<ResumeVersion> {
    const repository =
      manager?.getRepository(ResumeVersion) ?? this.versionsRepository;
    const version = await repository
      .createQueryBuilder('version')
      .innerJoin('version.resume', 'resume')
      .where('version.id = :id', { id })
      .andWhere('resume.userId = :userId', { userId })
      .getOne();

    if (version === null) {
      throw new NotFoundException('Resume version not found');
    }

    return version;
  }

  private assertJobMatch(versionJobId: string | null, jobId: string): void {
    if (versionJobId !== null && versionJobId !== jobId) {
      throw new BadRequestException(
        'jobId does not match the job of this resume version',
      );
    }
  }

  private toSnapshot(value: unknown): ResumeSnapshotInput {
    return value as ResumeSnapshotInput;
  }

  private toResponse(analysis: AtsAnalysis): AtsAnalysisResponseDto {
    return {
      id: analysis.id,
      resumeVersionId: analysis.resumeVersionId,
      jobId: analysis.jobId,
      score: analysis.score,
      breakdown: this.toArray(analysis.breakdown),
      checks: this.toArray(analysis.checks),
      matchedKeywords: this.toStringArray(analysis.matchedKeywords),
      missingKeywords: this.toStringArray(analysis.missingKeywords),
      createdAt: new Date(analysis.createdAt).toISOString(),
    };
  }

  private toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private toStringArray(value: unknown): string[] {
    return this.toArray(value).filter(
      (item): item is string => typeof item === 'string',
    );
  }
}
