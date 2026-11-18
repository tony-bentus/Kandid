import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decimalToNumber, numberToDecimal } from '../../common/utils/decimal.js';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import { normalizeText } from '../../common/utils/normalize.js';
import { assertNoForcedNull, hasField } from '../../common/utils/null-fields.js';
import { CreateProfileSkillDto } from './dto/create-profile-skill.dto.js';
import { ProfileSkillResponseDto } from './dto/profile-skill-response.dto.js';
import { SearchSkillsQueryDto } from './dto/search-skills-query.dto.js';
import { SkillResponseDto } from './dto/skill-response.dto.js';
import { UpdateProfileSkillDto } from './dto/update-profile-skill.dto.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Skill } from './entities/skill.entity.js';
import { Profile } from '../profiles/entities/profile.entity.js';

const DEFAULT_SEARCH_LIMIT = 20;
const NO_MATCH = Number.POSITIVE_INFINITY;

/** Menor rank entre nome e aliases: exato (0) > prefixo (1) > contém (2). */
function matchRank(value: string, needle: string): number {
  if (value === needle) {
    return 0;
  }
  if (value.startsWith(needle)) {
    return 1;
  }
  if (value.includes(needle)) {
    return 2;
  }
  return NO_MATCH;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

/** Ignora entradas não-string do JSON de aliases sem falhar na busca. */
function skillRank(skill: Skill, needle: string): number {
  const aliases: unknown = skill.aliases;
  const candidates: unknown[] = [
    skill.name,
    ...(Array.isArray(aliases) ? aliases : []),
  ];

  let best = NO_MATCH;
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    best = Math.min(best, matchRank(normalizeText(candidate), needle));
  }
  return best;
}

/**
 * Catálogo global de skills (somente leitura) e vínculos com o perfil do
 * usuário autenticado. Todo acesso a vínculos é escopado pelo `profileId`
 * resolvido a partir do `userId` do JWT.
 */
@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillsRepository: Repository<Skill>,
    @InjectRepository(ProfileSkill)
    private readonly profileSkillsRepository: Repository<ProfileSkill>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /**
   * GET /v1/skills — ranking em memória sobre o catálogo ordenado por nome
   * (ADR 0002, decisão 2).
   */
  async search(query: SearchSkillsQueryDto): Promise<SkillResponseDto[]> {
    const skills = await this.skillsRepository.find({ order: { name: 'ASC' } });
    const limit = query.limit ?? DEFAULT_SEARCH_LIMIT;
    const needle = normalizeText(query.q ?? '');

    if (needle === '') {
      return [...skills]
        .sort((left, right) => {
          const leftName = normalizeText(left.name);
          const rightName = normalizeText(right.name);
          return (
            compareStrings(leftName, rightName) || compareStrings(left.id, right.id)
          );
        })
        .slice(0, limit)
        .map((skill) => this.toSkillResponse(skill));
    }

    return skills
      .map((skill) => ({
        skill,
        rank: skillRank(skill, needle),
        name: normalizeText(skill.name),
      }))
      .filter((entry) => entry.rank !== NO_MATCH)
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          compareStrings(left.name, right.name) ||
          compareStrings(left.skill.id, right.skill.id),
      )
      .slice(0, limit)
      .map((entry) => this.toSkillResponse(entry.skill));
  }

  /** GET /v1/me/skills — vínculos do perfil por categoria e nome da skill. */
  async listProfileSkills(
    userId: string,
  ): Promise<ProfileSkillResponseDto[]> {
    const profile = await this.requireProfile(userId);
    const links = await this.profileSkillsRepository.find({
      where: { profileId: profile.id },
      relations: { skill: true },
      order: { skill: { category: 'ASC', name: 'ASC' }, id: 'ASC' },
    });

    return links.map((link) => this.toProfileSkillResponse(link));
  }

  /** POST /v1/me/skills — vincula uma skill existente ao perfil. */
  async addProfileSkill(
    userId: string,
    dto: CreateProfileSkillDto,
  ): Promise<ProfileSkillResponseDto> {
    const yearsExperience = this.toStoredYearsExperience(dto.yearsExperience);
    this.assertLastUsedYear(dto.lastUsedYear);

    const profile = await this.requireProfile(userId);
    if (!(await this.skillsRepository.existsBy({ id: dto.skillId }))) {
      throw new NotFoundException('Skill not found');
    }
    if (
      await this.profileSkillsRepository.existsBy({
        profileId: profile.id,
        skillId: dto.skillId,
      })
    ) {
      throw new ConflictException('Skill already linked to profile');
    }

    const link = this.profileSkillsRepository.create({
      profileId: profile.id,
      skillId: dto.skillId,
      level: dto.level,
      yearsExperience,
      lastUsedYear: dto.lastUsedYear ?? null,
    });

    let saved: ProfileSkill;
    try {
      saved = await this.profileSkillsRepository.save(link);
    } catch (error) {
      if (this.isProfileSkillDuplicate(error)) {
        throw new ConflictException('Skill already linked to profile');
      }
      throw error;
    }

    const withSkill = await this.requireProfileSkill(profile.id, saved.id);
    return this.toProfileSkillResponse(withSkill);
  }

  /** PATCH /v1/me/skills/:id — atualiza somente os campos presentes no DTO. */
  async updateProfileSkill(
    userId: string,
    profileSkillId: string,
    dto: UpdateProfileSkillDto,
  ): Promise<ProfileSkillResponseDto> {
    assertNoForcedNull(dto, ['level']);

    const profile = await this.requireProfile(userId);
    const link = await this.requireProfileSkill(profile.id, profileSkillId);

    if (hasField(dto, 'level') && dto.level !== undefined) {
      link.level = dto.level;
    }
    if (hasField(dto, 'yearsExperience')) {
      link.yearsExperience = this.toStoredYearsExperience(dto.yearsExperience);
    }
    if (hasField(dto, 'lastUsedYear')) {
      this.assertLastUsedYear(dto.lastUsedYear);
      link.lastUsedYear = dto.lastUsedYear ?? null;
    }

    const saved = await this.profileSkillsRepository.save(link);
    const withSkill = await this.requireProfileSkill(profile.id, saved.id);
    return this.toProfileSkillResponse(withSkill);
  }

  /** DELETE /v1/me/skills/:id — remove apenas o vínculo, nunca o catálogo. */
  async removeProfileSkill(
    userId: string,
    profileSkillId: string,
  ): Promise<void> {
    const profile = await this.requireProfile(userId);
    const link = await this.requireProfileSkill(profile.id, profileSkillId);
    await this.profileSkillsRepository.remove(link);
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

  private async requireProfileSkill(
    profileId: string,
    profileSkillId: string,
  ): Promise<ProfileSkill> {
    const link = await this.profileSkillsRepository.findOne({
      where: { id: profileSkillId, profileId },
      relations: { skill: true },
    });
    if (!link) {
      throw new NotFoundException('Profile skill not found');
    }
    return link;
  }

  private isProfileSkillDuplicate(error: unknown): boolean {
    return isDuplicateEntry(error, 'UQ_profile_skills_profile_skill');
  }

  private toStoredYearsExperience(value: number | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    if (!Number.isFinite(value) || value < 0 || value > 99.9) {
      throw new BadRequestException(
        'yearsExperience must be between 0 and 99.9',
      );
    }
    try {
      return numberToDecimal(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private assertLastUsedYear(year: number | null | undefined): void {
    if (year != null && year > new Date().getUTCFullYear()) {
      throw new BadRequestException('lastUsedYear cannot be in the future');
    }
  }

  private toSkillResponse(skill: Skill): SkillResponseDto {
    return {
      id: skill.id,
      name: skill.name,
      slug: skill.slug,
      category: skill.category,
      aliases: Array.isArray(skill.aliases)
        ? skill.aliases.filter(
            (alias): alias is string => typeof alias === 'string',
          )
        : [],
    };
  }

  private toProfileSkillResponse(link: ProfileSkill): ProfileSkillResponseDto {
    return {
      id: link.id,
      profileId: link.profileId,
      skillId: link.skillId,
      level: link.level,
      yearsExperience: decimalToNumber(link.yearsExperience ?? null),
      lastUsedYear: link.lastUsedYear,
      skill: this.toSkillResponse(link.skill),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}
