import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { assertDateOrder, dateOnlyToUtcMs } from '../../common/utils/dates.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import {
  CreateExperienceBulletDto,
} from './dto/create-experience-bullet.dto.js';
import { CreateExperienceDto } from './dto/create-experience.dto.js';
import { ExperienceBulletResponseDto } from './dto/experience-bullet-response.dto.js';
import { ExperienceResponseDto } from './dto/experience-response.dto.js';
import {
  UpdateExperienceBulletDto,
} from './dto/update-experience-bullet.dto.js';
import { UpdateExperienceDto } from './dto/update-experience.dto.js';
import { ExperienceBullet } from './entities/experience-bullet.entity.js';
import { Experience } from './entities/experience.entity.js';

/** Campos aceitos no PATCH de experiência (null limpa campos opcionais). */
const EXPERIENCE_PATCH_FIELDS = [
  'companyName',
  'role',
  'employmentType',
  'workModel',
  'location',
  'startDate',
  'endDate',
  'isCurrent',
  'description',
  'sortOrder',
] as const;

/** Campos aceitos no PATCH de bullet. */
const BULLET_PATCH_FIELDS = ['text', 'sortOrder'] as const;

/**
 * A entidade `Experience` não expõe a relation inversa `bullets`; elas são
 * carregadas por `experience_id` e anexadas apenas na resposta.
 */
type ExperienceWithBullets = Experience & { bullets?: ExperienceBullet[] };

/**
 * Experiências profissionais e suas bullets, sempre escopadas pelo perfil do
 * usuário autenticado.
 */
@Injectable()
export class ExperiencesService {
  constructor(
    @InjectRepository(Experience)
    private readonly experiencesRepository: Repository<Experience>,
    @InjectRepository(ExperienceBullet)
    private readonly bulletsRepository: Repository<ExperienceBullet>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /** POST /v1/me/experiences */
  async create(
    userId: string,
    dto: CreateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    const profile = await this.requireProfile(userId);
    const endDate = dto.endDate ?? null;
    // Sem `isCurrent` explícito, a presença de `endDate` define o estado:
    // sem endDate a experiência é atual; com endDate, é encerrada.
    const isCurrent = this.resolveIsCurrent(endDate, dto.isCurrent);
    this.assertDateRules(dto.startDate, endDate, isCurrent);

    const sortOrder =
      dto.sortOrder ?? (await this.nextExperienceSortOrder(profile.id));
    const experience = this.experiencesRepository.create({
      profileId: profile.id,
      companyName: dto.companyName,
      role: dto.role,
      employmentType: dto.employmentType ?? null,
      workModel: dto.workModel ?? null,
      location: dto.location ?? null,
      startDate: dto.startDate,
      endDate,
      isCurrent,
      description: dto.description ?? null,
      sortOrder,
    });
    const saved = await this.experiencesRepository.save(experience);

    return this.toExperienceResponse(saved, []);
  }

  /** GET /v1/me/experiences */
  async findAll(userId: string): Promise<ExperienceResponseDto[]> {
    const profile = await this.requireProfile(userId);
    const experiences = await this.experiencesRepository.find({
      where: { profileId: profile.id },
      order: { sortOrder: 'ASC', startDate: 'DESC', id: 'ASC' },
    });
    const bullets = await this.findBulletsByExperienceIds(
      experiences.map((experience) => experience.id),
    );

    return experiences.map((experience) =>
      this.toExperienceResponse(experience, bullets.get(experience.id) ?? []),
    );
  }

  /** GET /v1/me/experiences/:id */
  async findOne(
    userId: string,
    experienceId: string,
  ): Promise<ExperienceResponseDto> {
    const experience = await this.requireExperience(userId, experienceId);
    const bullets = await this.findBulletsByExperienceIds([experience.id]);

    return this.toExperienceResponse(
      experience,
      bullets.get(experience.id) ?? [],
    );
  }

  /** PATCH /v1/me/experiences/:id */
  async update(
    userId: string,
    experienceId: string,
    dto: UpdateExperienceDto,
  ): Promise<ExperienceResponseDto> {
    const experience = await this.requireExperience(userId, experienceId);
    assertNoForcedNull(dto, [
      'companyName',
      'role',
      'startDate',
      'isCurrent',
      'sortOrder',
    ]);
    this.applyPresentFields(experience, dto, EXPERIENCE_PATCH_FIELDS);

    // Revalida o estado final após o merge: um patch parcial pode quebrar a
    // combinação isCurrent/endDate ou a ordem entre as datas.
    this.assertDateRules(
      experience.startDate,
      experience.endDate ?? null,
      experience.isCurrent,
    );

    const saved = await this.experiencesRepository.save(experience);
    const bullets = await this.findBulletsByExperienceIds([saved.id]);

    return this.toExperienceResponse(saved, bullets.get(saved.id) ?? []);
  }

  /** DELETE /v1/me/experiences/:id — bullets removidas por ON DELETE CASCADE. */
  async remove(userId: string, experienceId: string): Promise<void> {
    const experience = await this.requireExperience(userId, experienceId);
    await this.experiencesRepository.remove(experience);
  }

  /** POST /v1/me/experiences/:id/bullets */
  async addBullet(
    userId: string,
    experienceId: string,
    dto: CreateExperienceBulletDto,
  ): Promise<ExperienceBulletResponseDto> {
    // A experiência é validada antes de qualquer escrita na bullet.
    const experience = await this.requireExperience(userId, experienceId);
    const sortOrder =
      dto.sortOrder ?? (await this.nextBulletSortOrder(experience.id));
    const bullet = this.bulletsRepository.create({
      experienceId: experience.id,
      text: dto.text,
      sortOrder,
    });
    const saved = await this.bulletsRepository.save(bullet);

    return this.toBulletResponse(saved);
  }

  /** PATCH /v1/me/experiences/:id/bullets/:bulletId */
  async updateBullet(
    userId: string,
    experienceId: string,
    bulletId: string,
    dto: UpdateExperienceBulletDto,
  ): Promise<ExperienceBulletResponseDto> {
    const experience = await this.requireExperience(userId, experienceId);
    const bullet = await this.requireBullet(experience, bulletId);
    assertNoForcedNull(dto, ['text', 'sortOrder']);
    this.applyPresentFields(bullet, dto, BULLET_PATCH_FIELDS);

    const saved = await this.bulletsRepository.save(bullet);

    return this.toBulletResponse(saved);
  }

  /** DELETE /v1/me/experiences/:id/bullets/:bulletId */
  async removeBullet(
    userId: string,
    experienceId: string,
    bulletId: string,
  ): Promise<void> {
    const experience = await this.requireExperience(userId, experienceId);
    const bullet = await this.requireBullet(experience, bulletId);
    await this.bulletsRepository.remove(bullet);
  }

  private async requireProfile(userId: string): Promise<Profile> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  private async requireExperience(
    userId: string,
    experienceId: string,
  ): Promise<Experience> {
    const profile = await this.requireProfile(userId);
    const experience = await this.experiencesRepository.findOne({
      where: { id: experienceId, profileId: profile.id },
    });
    if (!experience) {
      throw new NotFoundException('Experience not found');
    }

    return experience;
  }

  private async requireBullet(
    experience: Experience,
    bulletId: string,
  ): Promise<ExperienceBullet> {
    const bullet = await this.bulletsRepository.findOne({
      where: { id: bulletId, experienceId: experience.id },
    });
    if (!bullet) {
      throw new NotFoundException('Experience bullet not found');
    }

    return bullet;
  }

  private async findBulletsByExperienceIds(
    experienceIds: string[],
  ): Promise<Map<string, ExperienceBullet[]>> {
    const grouped = new Map<string, ExperienceBullet[]>();
    if (experienceIds.length === 0) {
      return grouped;
    }

    const bullets = await this.bulletsRepository.find({
      where: { experienceId: In(experienceIds) },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    for (const bullet of bullets) {
      const current = grouped.get(bullet.experienceId) ?? [];
      current.push(bullet);
      grouped.set(bullet.experienceId, current);
    }

    return grouped;
  }

  private async nextExperienceSortOrder(profileId: string): Promise<number> {
    const last = await this.experiencesRepository.find({
      where: { profileId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });

    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private async nextBulletSortOrder(experienceId: string): Promise<number> {
    const last = await this.bulletsRepository.find({
      where: { experienceId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });

    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private resolveIsCurrent(
    endDate: string | null,
    isCurrent: boolean | undefined,
  ): boolean {
    return isCurrent ?? endDate === null;
  }

  private assertDateRules(
    startDate: string,
    endDate: string | null,
    isCurrent: boolean,
  ): void {
    if (!Number.isFinite(dateOnlyToUtcMs(startDate))) {
      throw new BadRequestException('startDate must be a valid date');
    }
    if (endDate !== null && !Number.isFinite(dateOnlyToUtcMs(endDate))) {
      throw new BadRequestException('endDate must be a valid date');
    }
    if (isCurrent && endDate !== null) {
      throw new BadRequestException('endDate must be null when isCurrent is true');
    }
    if (!isCurrent && endDate === null) {
      throw new BadRequestException('endDate is required when isCurrent is false');
    }
    assertDateOrder(startDate, endDate, 'startDate');
  }

  private applyPresentFields(
    target: object,
    source: object,
    fields: readonly string[],
  ): void {
    const values = source as Record<string, unknown>;
    for (const field of fields) {
      if (hasField(source, field)) {
        Object.assign(target, { [field]: values[field] });
      }
    }
  }

  private toExperienceResponse(
    experience: ExperienceWithBullets,
    experienceBullets: readonly ExperienceBullet[],
  ): ExperienceResponseDto {
    const bullets = [...experienceBullets]
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
      )
      .map((bullet) => this.toBulletResponse(bullet));

    return {
      id: experience.id,
      profileId: experience.profileId,
      companyName: experience.companyName,
      role: experience.role,
      employmentType: experience.employmentType ?? null,
      workModel: experience.workModel ?? null,
      location: experience.location ?? null,
      startDate: experience.startDate,
      endDate: experience.endDate ?? null,
      isCurrent: experience.isCurrent,
      description: experience.description ?? null,
      sortOrder: experience.sortOrder,
      bullets,
      createdAt: experience.createdAt,
      updatedAt: experience.updatedAt,
    };
  }

  private toBulletResponse(
    bullet: ExperienceBullet,
  ): ExperienceBulletResponseDto {
    return {
      id: bullet.id,
      experienceId: bullet.experienceId,
      text: bullet.text,
      sortOrder: bullet.sortOrder,
      createdAt: bullet.createdAt,
      updatedAt: bullet.updatedAt,
    };
  }
}
