import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import {
  bigintCentsToNumber,
  numberToBigintCents,
} from '../../common/utils/money.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { Profile } from './entities/profile.entity.js';

const DEFAULT_CURRENCY = 'BRL';

/** Nomes possíveis da constraint UNIQUE de `profiles.user_id` na migration. */
const PROFILE_USER_UNIQUE_CONSTRAINTS = [
  'REL_9e432b7df0d182f8d292902d1a',
  'user_id',
] as const;

const NULLABLE_STRING_FIELDS = [
  'headline',
  'summary',
  'phone',
  'city',
  'state',
  'country',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'desiredRole',
  'availableFrom',
] as const;

/** String vazia (ou só espaços) e `null` explícito limpam a coluna opcional. */
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
 * Perfil profissional (1:1 com o usuário autenticado).
 *
 * `userId` é sempre o `sub` do JWT. GET nunca cria perfil; PATCH faz upsert
 * aplicando somente os campos presentes no DTO. Nenhuma resposta expõe o
 * relacionamento `user` nem dados de autenticação.
 */
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /**
   * GET /v1/me/profile
   *
   * Perfil ausente é 404, sem efeito colateral de criação.
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (profile === null) {
      throw new NotFoundException('Profile not found');
    }

    return this.toProfileResponse(profile);
  }

  /**
   * PATCH /v1/me/profile
   *
   * Cria na primeira chamada e atualiza nas seguintes. Uma corrida na UNIQUE
   * de `user_id` recarrega o perfil e reaplica o patch uma única vez.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    assertNoForcedNull(dto, ['currency']);

    let profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (profile === null) {
      profile = this.profilesRepository.create({ userId });
      profile.currency = DEFAULT_CURRENCY;
    }

    this.applyPatch(profile, dto);

    try {
      return this.toProfileResponse(await this.profilesRepository.save(profile));
    } catch (error) {
      if (!this.isProfileUserDuplicate(error)) {
        throw error;
      }

      const reloaded = await this.profilesRepository.findOne({
        where: { userId },
      });

      if (reloaded === null) {
        throw error;
      }

      this.applyPatch(reloaded, dto);

      return this.toProfileResponse(
        await this.profilesRepository.save(reloaded),
      );
    }
  }

  /** Aplica apenas as chaves efetivamente enviadas no PATCH. */
  private applyPatch(profile: Profile, dto: UpdateProfileDto): void {
    for (const field of NULLABLE_STRING_FIELDS) {
      if (hasField(dto, field)) {
        profile[field] = normalizeOptionalString(dto[field]);
      }
    }

    if (hasField(dto, 'desiredSeniority')) {
      profile.desiredSeniority = dto.desiredSeniority ?? null;
    }

    if (hasField(dto, 'workModelPreference')) {
      profile.workModelPreference = dto.workModelPreference ?? null;
    }

    if (hasField(dto, 'desiredSalaryCents')) {
      profile.desiredSalaryCents = this.toPersistedCents(
        dto.desiredSalaryCents,
      );
    }

    if (hasField(dto, 'currency')) {
      profile.currency = dto.currency ?? DEFAULT_CURRENCY;
    }
  }

  private toPersistedCents(value: number | null | undefined): string | null {
    try {
      if (value === null || value === undefined) {
        return null;
      }

      return numberToBigintCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private toResponseCents(raw: string | null | undefined): number | null {
    try {
      return bigintCentsToNumber(raw ?? null);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private isProfileUserDuplicate(error: unknown): boolean {
    return PROFILE_USER_UNIQUE_CONSTRAINTS.some((fragment) =>
      isDuplicateEntry(error, fragment),
    );
  }

  /** Mapper público: nunca inclui `user`, `passwordHash` ou afins. */
  private toProfileResponse(profile: Profile): ProfileResponseDto {
    return {
      id: profile.id,
      userId: profile.userId,
      headline: profile.headline ?? null,
      summary: profile.summary ?? null,
      phone: profile.phone ?? null,
      city: profile.city ?? null,
      state: profile.state ?? null,
      country: profile.country ?? null,
      linkedinUrl: profile.linkedinUrl ?? null,
      githubUrl: profile.githubUrl ?? null,
      portfolioUrl: profile.portfolioUrl ?? null,
      desiredRole: profile.desiredRole ?? null,
      desiredSeniority: profile.desiredSeniority ?? null,
      workModelPreference: profile.workModelPreference ?? null,
      desiredSalaryCents: this.toResponseCents(profile.desiredSalaryCents),
      currency: profile.currency ?? DEFAULT_CURRENCY,
      availableFrom: profile.availableFrom ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
