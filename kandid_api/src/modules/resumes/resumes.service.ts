import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  Not,
  type EntityManager,
  type Repository,
} from 'typeorm';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { Certification } from '../certifications/entities/certification.entity.js';
import { Education } from '../educations/entities/education.entity.js';
import { Experience } from '../experiences/entities/experience.entity.js';
import { ExperienceBullet } from '../experiences/entities/experience-bullet.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Language } from '../languages/entities/language.entity.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { ProfileSkill } from '../skills/entities/profile-skill.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateResumeDto } from './dto/create-resume.dto.js';
import { CreateResumeVersionDto } from './dto/create-resume-version.dto.js';
import { PaginatedResumesResponseDto } from './dto/paginated-resumes-response.dto.js';
import { QueryResumeDto } from './dto/query-resume.dto.js';
import { ResumeResponseDto } from './dto/resume-response.dto.js';
import { ResumeVersionResponseDto } from './dto/resume-version-response.dto.js';
import { UpdateResumeDto } from './dto/update-resume.dto.js';
import { Resume } from './entities/resume.entity.js';
import { ResumeVersion } from './entities/resume-version.entity.js';
import type { SnapshotSource } from './interfaces/snapshot-source.interface.js';
import { buildResumeSnapshot } from './snapshot.builder.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const RESUME_NAME_UNIQUE = 'UQ_resumes_user_name';
const RESUME_VERSION_UNIQUE = 'UQ_resume_versions_resume_version';

const MUTABLE_NULLABLE_FIELDS = ['name', 'targetRole', 'isDefault'] as const;

interface VersionInsert {
  resumeId: string;
  version: number;
  jobId: string | null;
  contentSnapshot: ResumeVersion['contentSnapshot'];
  generatedAt: Date;
}

/**
 * Currículos e versões imutáveis do usuário autenticado (KAN-40).
 *
 * Toda query é escopada por `userId` vindo do JWT; recurso alheio/inexistente
 * responde 404. O default único é trocado sob `pessimistic_write` na linha de
 * `users` (ADR 0005 `:313`). A geração de versão trava a linha de `resumes`,
 * calcula `MAX(version) + 1` dentro do lock e nunca escreve `ats_score`.
 */
@Injectable()
export class ResumesService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumesRepository: Repository<Resume>,
    @InjectRepository(ResumeVersion)
    private readonly resumeVersionsRepository: Repository<ResumeVersion>,
    private readonly dataSource: DataSource,
  ) {}

  /** POST /v1/resumes — o primeiro currículo vira default automaticamente. */
  async create(
    userId: string,
    dto: CreateResumeDto,
  ): Promise<ResumeResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, userId);

      const repository = manager.getRepository(Resume);
      const isFirst = !(await repository.existsBy({ userId }));

      if (!isFirst && (await repository.existsBy({ userId, name: dto.name }))) {
        throw new ConflictException('Resume name already exists for this user');
      }

      const isDefault = isFirst ? true : (dto.isDefault ?? false);
      if (isDefault && !isFirst) {
        await this.clearOtherDefaults(manager, userId);
      }

      const profile = await manager
        .getRepository(Profile)
        .findOne({ where: { userId } });

      const resume = repository.create({
        userId,
        name: dto.name,
        targetRole: dto.targetRole ?? profile?.desiredRole ?? '',
        isDefault,
      });

      try {
        return this.toResumeResponse(await repository.save(resume));
      } catch (error) {
        if (isDuplicateEntry(error, RESUME_NAME_UNIQUE)) {
          throw new ConflictException(
            'Resume name already exists for this user',
          );
        }
        throw error;
      }
    });
  }

  /** GET /v1/resumes — ordem fixa `createdAt DESC, id ASC`. */
  async findAll(
    userId: string,
    query: QueryResumeDto,
  ): Promise<PaginatedResumesResponseDto> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const [resumes, total] = await this.resumesRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: resumes.map((resume) => this.toResumeResponse(resume)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /** GET /v1/resumes/:id */
  async findOne(userId: string, id: string): Promise<ResumeResponseDto> {
    return this.toResumeResponse(await this.requireResume(userId, id));
  }

  /**
   * PATCH /v1/resumes/:id — campos ausentes são preservados; `null` é 400.
   *
   * Renomear para nome já usado responde 409. `isDefault: false` apenas limpa
   * o flag (o usuário pode ficar sem default, ADR 0005 decisão 7).
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateResumeDto,
  ): Promise<ResumeResponseDto> {
    assertNoForcedNull(dto, MUTABLE_NULLABLE_FIELDS);

    return this.dataSource.transaction(async (manager) => {
      if (hasField(dto, 'isDefault')) {
        await this.lockUser(manager, userId);
      }

      const repository = manager.getRepository(Resume);
      const resume = await repository.findOne({ where: { id, userId } });

      if (resume === null) {
        throw new NotFoundException('Resume not found');
      }

      if (hasField(dto, 'name')) {
        const name = this.requireValue(dto.name, 'name');

        if (await repository.existsBy({ userId, name, id: Not(id) })) {
          throw new ConflictException(
            'Resume name already exists for this user',
          );
        }

        resume.name = name;
      }

      if (hasField(dto, 'targetRole')) {
        resume.targetRole = this.requireValue(dto.targetRole, 'targetRole');
      }

      if (hasField(dto, 'isDefault')) {
        const isDefault = this.requireValue(dto.isDefault, 'isDefault');

        if (isDefault) {
          await this.clearOtherDefaults(manager, userId, id);
        }

        resume.isDefault = isDefault;
      }

      try {
        return this.toResumeResponse(await repository.save(resume));
      } catch (error) {
        if (isDuplicateEntry(error, RESUME_NAME_UNIQUE)) {
          throw new ConflictException(
            'Resume name already exists for this user',
          );
        }
        throw error;
      }
    });
  }

  /**
   * DELETE /v1/resumes/:id — 204 sem versões; 409 quando existe alguma versão.
   *
   * `resume_versions.resume_id` é `RESTRICT` no banco como última defesa; o
   * service devolve 409 antes para não apagar snapshots imutáveis.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, userId);

      const repository = manager.getRepository(Resume);
      // Mesma ordem de lock de `generateVersion` (users → resumes): sem o lock
      // em `resumes`, uma geração concorrente poderia inserir uma versão entre o
      // `countBy` e o `remove`, e o `RESTRICT` viraria 500 em vez de 409.
      const resume = await repository.findOne({
        where: { id, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (resume === null) {
        throw new NotFoundException('Resume not found');
      }

      const versions = await manager
        .getRepository(ResumeVersion)
        .countBy({ resumeId: id });

      if (versions > 0) {
        throw new ConflictException(
          'Resume has versions and cannot be deleted',
        );
      }

      await repository.remove(resume);
    });
  }

  /**
   * POST /v1/resumes/:id/versions — snapshot imutável sob transação.
   *
   * O lock em `resumes` serializa as gerações do mesmo currículo; a UNIQUE
   * `(resume_id, version)` é a última defesa e uma duplicata (`ER_DUP_ENTRY`)
   * relê `MAX(version)` uma única vez sob o mesmo lock antes de responder 409.
   * `ats_score` é gravado como `NULL` e nunca atualizado.
   */
  async generateVersion(
    userId: string,
    resumeId: string,
    dto: CreateResumeVersionDto = {},
  ): Promise<ResumeVersionResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const resume = await manager.getRepository(Resume).findOne({
        where: { id: resumeId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (resume === null) {
        throw new NotFoundException('Resume not found');
      }

      if (dto.jobId !== undefined) {
        const job = await manager
          .getRepository(Job)
          .findOne({ where: { id: dto.jobId, userId } });

        if (job === null) {
          throw new NotFoundException('Job not found');
        }
      }

      const source = await this.loadSnapshotSource(
        manager,
        userId,
        resume.targetRole,
      );
      const generatedAt = new Date();
      const contentSnapshot = buildResumeSnapshot(source, generatedAt);

      const repository = manager.getRepository(ResumeVersion);
      const nextVersion = await this.nextVersion(repository, resumeId);

      const saved = await this.saveVersion(repository, {
        resumeId,
        version: nextVersion,
        jobId: dto.jobId ?? null,
        contentSnapshot,
        generatedAt,
      });

      return this.toVersionResponse(saved);
    });
  }

  /** GET /v1/resume-versions/:id — ownership via join em `resumes.user_id`. */
  async findVersion(
    userId: string,
    id: string,
  ): Promise<ResumeVersionResponseDto> {
    const version = await this.resumeVersionsRepository
      .createQueryBuilder('resumeVersion')
      .innerJoin('resumeVersion.resume', 'resume')
      .where('resumeVersion.id = :id', { id })
      .andWhere('resume.userId = :userId', { userId })
      .getOne();

    if (version === null) {
      throw new NotFoundException('Resume version not found');
    }

    return this.toVersionResponse(version);
  }

  private async requireResume(userId: string, id: string): Promise<Resume> {
    const resume = await this.resumesRepository.findOne({
      where: { id, userId },
    });

    if (resume === null) {
      throw new NotFoundException('Resume not found');
    }

    return resume;
  }

  /**
   * Lock determinístico na linha de `users` antes de qualquer mudança em
   * `is_default` (ADR 0005 `:313`). A ordem fixa evita deadlock entre
   * requisições concorrentes do mesmo usuário.
   */
  private async lockUser(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (user === null) {
      throw new NotFoundException('User not found');
    }
  }

  private async clearOtherDefaults(
    manager: EntityManager,
    userId: string,
    exceptId?: string,
  ): Promise<void> {
    await manager.getRepository(Resume).update(
      exceptId === undefined
        ? { userId }
        : { userId, id: Not(exceptId) },
      { isDefault: false },
    );
  }

  private async loadSnapshotSource(
    manager: EntityManager,
    userId: string,
    targetRole: string,
  ): Promise<SnapshotSource> {
    const user = await manager
      .getRepository(User)
      .findOne({ where: { id: userId } });

    if (user === null) {
      throw new NotFoundException('User not found');
    }

    const profile = await manager
      .getRepository(Profile)
      .findOne({ where: { userId } });

    if (profile === null) {
      throw new BadRequestException(
        'Profile is required to generate a resume version',
      );
    }

    const experiences = await manager
      .getRepository(Experience)
      .find({ where: { profileId: profile.id } });

    const bullets =
      experiences.length === 0
        ? []
        : await manager.getRepository(ExperienceBullet).find({
            where: {
              experienceId: In(experiences.map((experience) => experience.id)),
            },
          });

    const profileSkills = await manager.getRepository(ProfileSkill).find({
      where: { profileId: profile.id },
      relations: { skill: true },
    });

    const education = await manager
      .getRepository(Education)
      .find({ where: { profileId: profile.id } });

    const certifications = await manager
      .getRepository(Certification)
      .find({ where: { profileId: profile.id } });

    const languages = await manager
      .getRepository(Language)
      .find({ where: { profileId: profile.id } });

    return {
      user,
      profile,
      targetRole,
      experiences,
      bullets,
      profileSkills,
      education,
      certifications,
      languages,
    };
  }

  /** `MAX(version) + 1` dentro do lock; primeira versão é 1. */
  private async nextVersion(
    repository: Repository<ResumeVersion>,
    resumeId: string,
  ): Promise<number> {
    const raw = await repository
      .createQueryBuilder('resumeVersion')
      .select('MAX(resumeVersion.version)', 'maxVersion')
      .where('resumeVersion.resumeId = :resumeId', { resumeId })
      .getRawOne<{ maxVersion: number | null }>();

    const maxVersion = raw?.maxVersion;

    return (maxVersion === null || maxVersion === undefined
      ? 0
      : Number(maxVersion)) + 1;
  }

  private async saveVersion(
    repository: Repository<ResumeVersion>,
    insert: VersionInsert,
  ): Promise<ResumeVersion> {
    let version = insert.version;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const entity = repository.create({
        resumeId: insert.resumeId,
        version,
        jobId: insert.jobId,
        contentSnapshot: insert.contentSnapshot,
        atsScore: null,
        createdAt: insert.generatedAt,
      });

      try {
        return await repository.save(entity);
      } catch (error) {
        if (!isDuplicateEntry(error, RESUME_VERSION_UNIQUE)) {
          throw error;
        }

        if (attempt === 1) {
          throw new ConflictException('Version already generated');
        }

        // Repetição única da leitura de MAX sob o mesmo lock do `resume`.
        version = await this.nextVersion(repository, insert.resumeId);
      }
    }

    throw new ConflictException('Version already generated');
  }

  private requireValue<T>(value: T | null | undefined, field: string): T {
    if (value === null || value === undefined) {
      throw new BadRequestException(`${field} cannot be null`);
    }

    return value;
  }

  private requireIso(value: Date | null | undefined): string {
    if (value == null) {
      throw new Error('Expected a persisted datetime');
    }

    return value.toISOString();
  }

  private toResumeResponse(resume: Resume): ResumeResponseDto {
    return {
      id: resume.id,
      userId: resume.userId,
      name: resume.name,
      targetRole: resume.targetRole,
      isDefault: resume.isDefault,
      createdAt: this.requireIso(resume.createdAt),
      updatedAt: this.requireIso(resume.updatedAt),
    };
  }

  private toVersionResponse(version: ResumeVersion): ResumeVersionResponseDto {
    return {
      id: version.id,
      resumeId: version.resumeId,
      version: version.version,
      jobId: version.jobId ?? null,
      contentSnapshot: version.contentSnapshot,
      // Sem UPDATE em resume_versions nesta sprint: sempre null (ADR 0005).
      atsScore: null,
      createdAt: this.requireIso(version.createdAt),
    };
  }
}
