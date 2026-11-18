import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager, type Repository } from 'typeorm';
import {
  bigintCentsToNumber,
  numberToBigintCents,
} from '../../common/utils/money.js';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import { normalizeText } from '../../common/utils/normalize.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { Application } from '../applications/entities/application.entity.js';
import { SkillResponseDto } from '../skills/dto/skill-response.dto.js';
import { Skill } from '../skills/entities/skill.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { Recruiter } from '../recruiters/entities/recruiter.entity.js';
import { CreateJobDto, JobSkillDto } from './dto/create-job.dto.js';
import { JobResponseDto } from './dto/job-response.dto.js';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto.js';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { Job } from './entities/job.entity.js';
import { JobSkill } from './entities/job-skill.entity.js';

const DEFAULT_CURRENCY = 'BRL';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Campos que nunca aceitam `null` explícito. `skills` entra na lista porque
 * `null` não é array: use `[]` para limpar a stack.
 */
const REQUIRED_FIELDS = [
  'companyId',
  'title',
  'source',
  'salaryPeriod',
  'currency',
  'skills',
] as const;

type CentsFieldName = 'salaryRangeMinCents' | 'salaryRangeMaxCents';

interface NormalizedJobSkill {
  skillId: string;
  isRequired: boolean;
}

/** String vazia (ou só espaços) e `null` limpam a coluna opcional. */
function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Vagas do usuário autenticado. Todo acesso é escopado pelo `userId` do JWT:
 * recurso alheio ou inexistente responde 404; em filtro de coleção,
 * `companyId` alheio apenas estreita o resultado (envelope vazio).
 */
@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(JobSkill)
    private readonly jobSkillsRepository: Repository<JobSkill>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(Recruiter)
    private readonly recruitersRepository: Repository<Recruiter>,
    @InjectRepository(Skill)
    private readonly skillsRepository: Repository<Skill>,
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /v1/jobs — cria a vaga e a stack no mesmo bloco transacional. */
  async create(userId: string, dto: CreateJobDto): Promise<JobResponseDto> {
    assertNoForcedNull(dto, REQUIRED_FIELDS);

    const title = this.requireTitle(dto.title);
    this.assertRange(dto.salaryRangeMinCents, dto.salaryRangeMaxCents);
    const skills = this.normalizeSkills(dto.skills);

    await this.requireOwnedCompany(userId, dto.companyId);
    if (dto.recruiterId != null) {
      await this.requireOwnedRecruiter(userId, dto.recruiterId);
    }
    await this.assertCatalogSkills(skills);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Job);
      const job = repository.create({
        userId,
        companyId: dto.companyId,
        recruiterId: dto.recruiterId ?? null,
        title,
        description: normalizeOptionalString(dto.description),
        seniority: dto.seniority ?? null,
        workModel: dto.workModel ?? null,
        contractType: dto.contractType ?? null,
        location: normalizeOptionalString(dto.location),
        source: dto.source,
        sourceUrl: normalizeOptionalString(dto.sourceUrl),
        salaryRangeMinCents: this.toPersistedCents(
          dto.salaryRangeMinCents,
          'salaryRangeMinCents',
        ),
        salaryRangeMaxCents: this.toPersistedCents(
          dto.salaryRangeMaxCents,
          'salaryRangeMaxCents',
        ),
        currency: dto.currency ?? DEFAULT_CURRENCY,
        salaryPeriod: dto.salaryPeriod,
        postedAt: dto.postedAt ?? null,
        applicationDeadline: dto.applicationDeadline ?? null,
        notes: normalizeOptionalString(dto.notes),
      });

      const saved = await repository.save(job);
      await this.insertJobSkills(manager, saved, skills);

      return this.toJobResponse(saved, await this.loadJobSkills(saved.id, manager));
    });
  }

  /** GET /v1/jobs — filtros em AND, ordenação fixa e envelope paginado. */
  async findAll(
    userId: string,
    query: ListJobsQueryDto,
  ): Promise<PaginatedJobsResponseDto> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.jobsRepository
      .createQueryBuilder('job')
      .where('job.userId = :userId', { userId });

    // Não há checagem de posse aqui: um companyId alheio simplesmente não
    // corresponde a nenhuma vaga deste usuário (envelope vazio, sem 404).
    if (query.companyId != null) {
      qb.andWhere('job.companyId = :companyId', { companyId: query.companyId });
    }

    if (query.seniority != null) {
      qb.andWhere('job.seniority = :seniority', {
        seniority: query.seniority,
      });
    }

    if (query.skillId != null) {
      if (!(await this.skillsRepository.existsBy({ id: query.skillId }))) {
        throw new NotFoundException('Skill not found');
      }

      const stackQuery = this.jobSkillsRepository
        .createQueryBuilder('js')
        .select('1')
        .where('js.jobId = job.id')
        .andWhere('js.skillId = :skillId', { skillId: query.skillId });

      qb.andWhere(`EXISTS (${stackQuery.getQuery()})`, stackQuery.getParameters());
    }

    const term = normalizeText(query.q ?? '');
    if (term.length > 0) {
      const pattern = `%${this.escapeLike(term)}%`;

      qb.andWhere(
        `(job.title LIKE :search ESCAPE '\\\\' OR job.description LIKE :search ESCAPE '\\\\')`,
        { search: pattern },
      );
    }

    const [jobs, total] = await qb
      .orderBy('job.postedAt', 'DESC')
      .addOrderBy('job.createdAt', 'DESC')
      .addOrderBy('job.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = await Promise.all(
      jobs.map(async (job) =>
        this.toJobResponse(job, await this.loadJobSkills(job.id)),
      ),
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /** GET /v1/jobs/:id */
  async findOne(userId: string, id: string): Promise<JobResponseDto> {
    const job = await this.requireJob(userId, id);

    return this.toJobResponse(job, await this.loadJobSkills(id));
  }

  /**
   * PATCH /v1/jobs/:id — a vaga é resolvida antes de qualquer validação 400.
   * Com `skills` presente, stack é substituída por completo sob
   * `pessimistic_write` na linha da vaga (delete + insert atômicos).
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    const job = await this.requireJob(userId, id);
    assertNoForcedNull(dto, REQUIRED_FIELDS);

    const skillsPresent = hasField(dto, 'skills');
    const skills = skillsPresent ? this.normalizeSkills(dto.skills) : [];

    if (skillsPresent) {
      await this.assertCatalogSkills(skills);
    }

    if (dto.companyId != null) {
      await this.requireOwnedCompany(userId, dto.companyId);
    }
    if (dto.recruiterId != null) {
      await this.requireOwnedRecruiter(userId, dto.recruiterId);
    }
    this.assertRangeFromPatch(job, dto);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Job);
      const locked = await repository.findOne({
        where: { id, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (locked === null) {
        throw new NotFoundException('Job not found');
      }

      this.applyPatch(locked, dto);
      const saved = await repository.save(locked);

      if (skillsPresent) {
        await manager.getRepository(JobSkill).delete({ jobId: id });
        await this.insertJobSkills(manager, saved, skills);
      }

      return this.toJobResponse(saved, await this.loadJobSkills(id, manager));
    });
  }

  /** DELETE /v1/jobs/:id — job_skills é removida por cascata no banco. */
  async remove(userId: string, id: string): Promise<void> {
    const job = await this.requireJob(userId, id);

    if ((await this.applicationsRepository.countBy({ jobId: id })) > 0) {
      throw new ConflictException('Cannot delete job with applications');
    }

    await this.jobsRepository.remove(job);
  }

  private async requireJob(userId: string, id: string): Promise<Job> {
    const job = await this.jobsRepository.findOne({
      where: { id, userId },
    });

    if (job === null) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireOwnedCompany(
    userId: string,
    id: string,
  ): Promise<Company> {
    const company = await this.companiesRepository.findOne({
      where: { id, userId },
    });

    if (company === null) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async requireOwnedRecruiter(
    userId: string,
    id: string,
  ): Promise<Recruiter> {
    const recruiter = await this.recruitersRepository.findOne({
      where: { id, userId },
    });

    if (recruiter === null) {
      throw new NotFoundException('Recruiter not found');
    }

    return recruiter;
  }

  private normalizeSkills(
    skills: JobSkillDto[] | null | undefined,
  ): NormalizedJobSkill[] {
    const seen = new Set<string>();

    return (skills ?? []).map((item) => {
      const raw: unknown = item;
      if (raw === null || typeof raw !== 'object') {
        throw new BadRequestException('skills must contain objects');
      }
      if (seen.has(item.skillId)) {
        throw new BadRequestException('Duplicate skillId in skills');
      }

      seen.add(item.skillId);

      return { skillId: item.skillId, isRequired: item.isRequired ?? true };
    });
  }

  private async assertCatalogSkills(
    skills: readonly NormalizedJobSkill[],
  ): Promise<void> {
    if (skills.length === 0) {
      return;
    }

    const ids = [...new Set(skills.map((item) => item.skillId))];
    const found = await this.skillsRepository.find({
      where: { id: In(ids) },
      select: { id: true },
    });

    if (found.length !== ids.length) {
      throw new NotFoundException('Skill not found');
    }
  }

  private async insertJobSkills(
    manager: EntityManager,
    job: Job,
    skills: readonly NormalizedJobSkill[],
  ): Promise<void> {
    if (skills.length === 0) {
      return;
    }

    const repository = manager.getRepository(JobSkill);
    const links = skills.map((item) =>
      repository.create({
        jobId: job.id,
        job,
        skillId: item.skillId,
        isRequired: item.isRequired,
      }),
    );

    try {
      // Apenas este bloco traduz ER_DUP_ENTRY de PRIMARY: um PRIMARY de
      // outra tabela não deve ser confundido com duplicata de job_skills.
      await repository.save(links);
    } catch (error) {
      if (isDuplicateEntry(error, 'PRIMARY')) {
        throw new ConflictException('Skill already linked to job');
      }
      throw error;
    }
  }

  private async loadJobSkills(
    jobId: string,
    manager?: EntityManager,
  ): Promise<JobSkill[]> {
    const repository =
      manager?.getRepository(JobSkill) ?? this.jobSkillsRepository;

    return repository.find({
      where: { jobId },
      relations: { skill: true },
      order: { skill: { name: 'ASC' }, skillId: 'ASC' },
    });
  }

  private applyPatch(job: Job, dto: UpdateJobDto): void {
    if (hasField(dto, 'companyId')) {
      job.companyId = this.requireValue(dto.companyId, 'companyId');
    }
    if (hasField(dto, 'recruiterId')) {
      job.recruiterId = dto.recruiterId ?? null;
    }
    if (hasField(dto, 'title')) {
      job.title = this.requireTitle(dto.title);
    }
    if (hasField(dto, 'description')) {
      job.description = normalizeOptionalString(dto.description);
    }
    if (hasField(dto, 'seniority')) {
      job.seniority = dto.seniority ?? null;
    }
    if (hasField(dto, 'workModel')) {
      job.workModel = dto.workModel ?? null;
    }
    if (hasField(dto, 'contractType')) {
      job.contractType = dto.contractType ?? null;
    }
    if (hasField(dto, 'location')) {
      job.location = normalizeOptionalString(dto.location);
    }
    if (hasField(dto, 'source')) {
      job.source = this.requireValue(dto.source, 'source');
    }
    if (hasField(dto, 'sourceUrl')) {
      job.sourceUrl = normalizeOptionalString(dto.sourceUrl);
    }
    if (hasField(dto, 'salaryRangeMinCents')) {
      job.salaryRangeMinCents = this.toPersistedCents(
        dto.salaryRangeMinCents,
        'salaryRangeMinCents',
      );
    }
    if (hasField(dto, 'salaryRangeMaxCents')) {
      job.salaryRangeMaxCents = this.toPersistedCents(
        dto.salaryRangeMaxCents,
        'salaryRangeMaxCents',
      );
    }
    if (hasField(dto, 'currency')) {
      job.currency = dto.currency ?? DEFAULT_CURRENCY;
    }
    if (hasField(dto, 'salaryPeriod')) {
      job.salaryPeriod = this.requireValue(dto.salaryPeriod, 'salaryPeriod');
    }
    if (hasField(dto, 'postedAt')) {
      job.postedAt = dto.postedAt ?? null;
    }
    if (hasField(dto, 'applicationDeadline')) {
      job.applicationDeadline = dto.applicationDeadline ?? null;
    }
    if (hasField(dto, 'notes')) {
      job.notes = normalizeOptionalString(dto.notes);
    }
  }

  /** Compara o valor efetivo da faixa (patch + persistido) no PATCH. */
  private assertRangeFromPatch(job: Job, dto: UpdateJobDto): void {
    const min = hasField(dto, 'salaryRangeMinCents')
      ? dto.salaryRangeMinCents
      : this.toResponseCents(
          job.salaryRangeMinCents,
          'salaryRangeMinCents',
        );
    const max = hasField(dto, 'salaryRangeMaxCents')
      ? dto.salaryRangeMaxCents
      : this.toResponseCents(
          job.salaryRangeMaxCents,
          'salaryRangeMaxCents',
        );

    this.assertRange(min, max);
  }

  private assertRange(
    min: number | null | undefined,
    max: number | null | undefined,
  ): void {
    if (min != null && max != null && min > max) {
      throw new BadRequestException(
        'salaryRangeMinCents must be less than or equal to salaryRangeMaxCents',
      );
    }
  }

  private requireValue<T>(value: T | null | undefined, field: string): T {
    if (value === null || value === undefined) {
      throw new BadRequestException(`${field} cannot be null`);
    }

    return value;
  }

  private requireTitle(value: string | null | undefined): string {
    const title = value?.trim();

    if (title === undefined || title.length === 0) {
      throw new BadRequestException('title must not be empty');
    }

    return title;
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

  /** `LIKE` com `ESCAPE '\'`: literal `%`, `_` e `\` não viram curingas. */
  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private toSkillResponse(skill: Skill): SkillResponseDto {
    const aliases: unknown = skill.aliases;

    return {
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      category: skill.category,
      aliases: Array.isArray(aliases)
        ? aliases.filter(
            (alias): alias is string => typeof alias === 'string',
          )
        : [],
    };
  }

  private toJobResponse(
    job: Job,
    jobSkills: readonly JobSkill[],
  ): JobResponseDto {
    return {
      id: job.id,
      userId: job.userId,
      companyId: job.companyId,
      recruiterId: job.recruiterId ?? null,
      title: job.title,
      description: job.description ?? null,
      seniority: job.seniority ?? null,
      workModel: job.workModel ?? null,
      contractType: job.contractType ?? null,
      location: job.location ?? null,
      source: job.source,
      sourceUrl: job.sourceUrl ?? null,
      salaryRangeMinCents: this.toResponseCents(
        job.salaryRangeMinCents,
        'salaryRangeMinCents',
      ),
      salaryRangeMaxCents: this.toResponseCents(
        job.salaryRangeMaxCents,
        'salaryRangeMaxCents',
      ),
      currency: job.currency ?? DEFAULT_CURRENCY,
      salaryPeriod: job.salaryPeriod,
      postedAt: job.postedAt ?? null,
      applicationDeadline: job.applicationDeadline ?? null,
      notes: job.notes ?? null,
      skills: jobSkills.map((link) => ({
        skillId: link.skillId,
        isRequired: link.isRequired,
        skill: this.toSkillResponse(link.skill),
      })),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
