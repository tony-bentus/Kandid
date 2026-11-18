import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { APPLICATION_TRANSITIONS } from '../../common/enums/application-transitions.js';
import { dateOnlyToUtcMs } from '../../common/utils/dates.js';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import {
  bigintCentsToNumber,
  numberToBigintCents,
} from '../../common/utils/money.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Application } from './entities/application.entity.js';
import { ApplicationStatusHistory } from './entities/application-status-history.entity.js';
import { ApplicationResponseDto } from './dto/application-response.dto.js';
import { ApplicationStatusHistoryResponseDto } from './dto/application-status-history-response.dto.js';
import { CreateApplicationDto } from './dto/create-application.dto.js';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto.js';
import { PaginatedApplicationsResponseDto } from './dto/paginated-applications-response.dto.js';
import { UpdateApplicationCompensationDto } from './dto/update-application-compensation.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MS_PER_DAY = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.HIRED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
  ApplicationStatus.CANCELLED,
]);

const NON_NULLABLE_COMPENSATION_FIELDS = [
  'proposedSalaryCents',
  'offeredSalaryCents',
  'currency',
  'salaryPeriod',
] as const;

type CentsFieldName = 'proposedSalaryCents' | 'offeredSalaryCents';

function toDateOrNull(value: string | null | undefined): Date | null {
  return value == null ? null : new Date(value);
}

function toIsoOrNull(value: Date | null | undefined): string | null {
  return value == null ? null : value.toISOString();
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function assertValidDateOnly(value: string, field: string): void {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new BadRequestException(
      `${field} must be a valid date in YYYY-MM-DD format`,
    );
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException(
      `${field} must be a valid date in YYYY-MM-DD format`,
    );
  }
}

function assertDateRange(query: ListApplicationsQueryDto): void {
  if (query.from !== undefined) {
    assertValidDateOnly(query.from, 'from');
  }
  if (query.to !== undefined) {
    assertValidDateOnly(query.to, 'to');
  }
  if (
    query.from !== undefined &&
    query.to !== undefined &&
    dateOnlyToUtcMs(query.from) > dateOnlyToUtcMs(query.to)
  ) {
    throw new BadRequestException('from must be before or equal to to');
  }
}

/**
 * Candidaturas do usuário autenticado. Todo acesso é escopado por `userId`:
 * recurso alheio/inexistente responde 404; `companyId` em filtro apenas
 * estreita a coleção (envelope vazio, sem 404).
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepository: Repository<ApplicationStatusHistory>,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /v1/jobs/:id/applications — criação sem linha de histórico. */
  async create(
    userId: string,
    jobId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const job = await manager.getRepository(Job).findOne({
        where: { id: jobId, userId },
      });

      if (job === null) {
        throw new NotFoundException('Job not found');
      }

      const repository = manager.getRepository(Application);
      if (await repository.existsBy({ userId, jobId })) {
        throw new ConflictException('Application already exists for this job');
      }

      const application = repository.create({
        userId,
        jobId,
        status: ApplicationStatus.SAVED,
        appliedAt: null,
        resumeVersionId: null,
        proposedSalaryCents: this.toPersistedCents(
          dto.proposedSalaryCents,
          'proposedSalaryCents',
        ),
        offeredSalaryCents: this.toPersistedCents(
          dto.offeredSalaryCents,
          'offeredSalaryCents',
        ),
        currency: dto.currency ?? job.currency,
        salaryPeriod: dto.salaryPeriod ?? job.salaryPeriod,
        benefits: dto.benefits ?? null,
        nextStepAt: toDateOrNull(dto.nextStepAt),
        lastContactAt: toDateOrNull(dto.lastContactAt),
        rejectionReason: dto.rejectionReason ?? null,
        closedAt: null,
        notes: dto.notes ?? null,
      });

      let saved: Application;
      try {
        saved = await repository.save(application);
      } catch (error) {
        // Pré-checagem acima cobre o caso comum; isto cobre a corrida.
        if (isDuplicateEntry(error, 'UQ_applications_user_job')) {
          throw new ConflictException('Application already exists for this job');
        }
        throw error;
      }

      return this.toResponse(saved);
    });
  }

  /**
   * PATCH /v1/applications/:id/status — status e histórico na mesma transação,
   * com `pessimistic_write` para serializar transições concorrentes.
   */
  async transition(
    userId: string,
    id: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Application);
      const application = await repository.findOne({
        where: { id, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (application === null) {
        throw new NotFoundException('Application not found');
      }

      const fromStatus = application.status;
      const allowed = APPLICATION_TRANSITIONS[fromStatus] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid transition from ${fromStatus}. Allowed statuses: ${
            allowed.length === 0 ? 'none' : allowed.join(', ')
          }`,
        );
      }

      const now = new Date();
      application.status = dto.status;

      if (
        dto.status === ApplicationStatus.APPLIED &&
        application.appliedAt === null
      ) {
        application.appliedAt = toDateOnly(now);
      }
      if (TERMINAL_STATUSES.has(dto.status)) {
        application.closedAt = now;
      }

      const saved = await repository.save(application);
      const historyRepository = manager.getRepository(ApplicationStatusHistory);
      await historyRepository.save(
        historyRepository.create({
          applicationId: saved.id,
          fromStatus,
          toStatus: dto.status,
          note: dto.note ?? null,
          changedAt: now,
        }),
      );

      return this.toResponse(saved);
    });
  }

  /** PATCH /v1/applications/:id/compensation — ausência preserva o valor. */
  async updateCompensation(
    userId: string,
    id: string,
    dto: UpdateApplicationCompensationDto,
  ): Promise<ApplicationResponseDto> {
    assertNoForcedNull(dto, NON_NULLABLE_COMPENSATION_FIELDS);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Application);
      const application = await repository.findOne({
        where: { id, userId },
      });

      if (application === null) {
        throw new NotFoundException('Application not found');
      }

      if (hasField(dto, 'proposedSalaryCents')) {
        application.proposedSalaryCents = this.toPersistedCents(
          dto.proposedSalaryCents,
          'proposedSalaryCents',
        );
      }
      if (hasField(dto, 'offeredSalaryCents')) {
        application.offeredSalaryCents = this.toPersistedCents(
          dto.offeredSalaryCents,
          'offeredSalaryCents',
        );
      }
      if (hasField(dto, 'currency')) {
        application.currency = this.requireValue(dto.currency, 'currency');
      }
      if (hasField(dto, 'salaryPeriod')) {
        application.salaryPeriod = this.requireValue(
          dto.salaryPeriod,
          'salaryPeriod',
        );
      }
      if (hasField(dto, 'benefits')) {
        application.benefits = dto.benefits ?? null;
      }
      if (hasField(dto, 'notes')) {
        application.notes = dto.notes ?? null;
      }
      if (hasField(dto, 'nextStepAt')) {
        application.nextStepAt = toDateOrNull(dto.nextStepAt);
      }
      if (hasField(dto, 'lastContactAt')) {
        application.lastContactAt = toDateOrNull(dto.lastContactAt);
      }
      if (hasField(dto, 'rejectionReason')) {
        application.rejectionReason = dto.rejectionReason ?? null;
      }

      const saved = await repository.save(application);

      return this.toResponse(saved);
    });
  }

  /** GET /v1/applications — filtros em AND, ordem fixa e envelope paginado. */
  async findAll(
    userId: string,
    query: ListApplicationsQueryDto,
  ): Promise<PaginatedApplicationsResponseDto> {
    assertDateRange(query);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.applicationsRepository
      .createQueryBuilder('application')
      .where('application.userId = :userId', { userId });

    if (query.status !== undefined) {
      qb.andWhere('application.status = :status', { status: query.status });
    }

    // Empresa alheia/inexistente apenas não corresponde a nenhuma candidatura
    // deste usuário: envelope vazio, sem 404.
    if (query.companyId !== undefined) {
      qb.innerJoin('application.job', 'job').andWhere(
        'job.companyId = :companyId',
        { companyId: query.companyId },
      );
    }

    if (query.from !== undefined) {
      qb.andWhere('application.createdAt >= :from', {
        from: new Date(dateOnlyToUtcMs(query.from)),
      });
    }
    if (query.to !== undefined) {
      qb.andWhere('application.createdAt <= :to', {
        to: new Date(dateOnlyToUtcMs(query.to) + MS_PER_DAY - 1),
      });
    }

    const [applications, total] = await qb
      .orderBy('application.createdAt', 'DESC')
      .addOrderBy('application.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: applications.map((application) => this.toResponse(application)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /** GET /v1/applications/:id */
  async findOne(
    userId: string,
    id: string,
  ): Promise<ApplicationResponseDto> {
    return this.toResponse(await this.requireApplication(userId, id));
  }

  /** GET /v1/applications/:id/history — ordem fixa e append-only. */
  async history(
    userId: string,
    id: string,
  ): Promise<ApplicationStatusHistoryResponseDto[]> {
    await this.requireApplication(userId, id);

    const rows = await this.historyRepository.find({
      where: { applicationId: id },
      order: { changedAt: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => this.toHistoryResponse(row));
  }

  private async requireApplication(
    userId: string,
    id: string,
  ): Promise<Application> {
    const application = await this.applicationsRepository.findOne({
      where: { id, userId },
    });

    if (application === null) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  private requireValue<T>(value: T | null | undefined, field: string): T {
    if (value === null || value === undefined) {
      throw new BadRequestException(`${field} cannot be null`);
    }

    return value;
  }

  private toPersistedCents(
    value: number | null | undefined,
    fieldName: CentsFieldName,
  ): string | null {
    try {
      return numberToBigintCents(value ?? null, fieldName);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private toResponseCents(
    raw: string | null | undefined,
    fieldName: CentsFieldName,
  ): number | null {
    try {
      return bigintCentsToNumber(raw ?? null, fieldName);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private toResponse(application: Application): ApplicationResponseDto {
    return {
      id: application.id,
      userId: application.userId,
      jobId: application.jobId,
      status: application.status,
      appliedAt: application.appliedAt ?? null,
      resumeVersionId: null,
      proposedSalaryCents: this.toResponseCents(
        application.proposedSalaryCents,
        'proposedSalaryCents',
      ),
      offeredSalaryCents: this.toResponseCents(
        application.offeredSalaryCents,
        'offeredSalaryCents',
      ),
      currency: application.currency,
      salaryPeriod: application.salaryPeriod,
      benefits: application.benefits ?? null,
      nextStepAt: toIsoOrNull(application.nextStepAt),
      lastContactAt: toIsoOrNull(application.lastContactAt),
      rejectionReason: application.rejectionReason ?? null,
      closedAt: toIsoOrNull(application.closedAt),
      notes: application.notes ?? null,
      createdAt: this.requireIso(application.createdAt),
      updatedAt: this.requireIso(application.updatedAt),
    };
  }

  private toHistoryResponse(
    row: ApplicationStatusHistory,
  ): ApplicationStatusHistoryResponseDto {
    return {
      id: row.id,
      applicationId: row.applicationId,
      fromStatus: row.fromStatus ?? null,
      toStatus: row.toStatus,
      note: row.note ?? null,
      changedAt: this.requireIso(row.changedAt),
    };
  }

  private requireIso(value: Date | null | undefined): string {
    if (value == null) {
      throw new Error('Expected a persisted datetime');
    }

    return value.toISOString();
  }
}
