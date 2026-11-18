import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertNoForcedNull, hasField } from '../../common/utils/null-fields.js';
import { normalizeText } from '../../common/utils/normalize.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { CreateLanguageDto } from './dto/create-language.dto.js';
import { LanguageResponseDto } from './dto/language-response.dto.js';
import { UpdateLanguageDto } from './dto/update-language.dto.js';
import { Language } from './entities/language.entity.js';

/** Colunas NOT NULL que `PartialType` poderia transformar em ausência via `null`. */
const REQUIRED_UPDATE_FIELDS = ['name', 'proficiency'] as const;

/** Idiomas do perfil do usuário autenticado. */
@Injectable()
export class LanguagesService {
  constructor(
    @InjectRepository(Language)
    private readonly languagesRepository: Repository<Language>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /** POST /v1/me/languages */
  async create(
    userId: string,
    dto: CreateLanguageDto,
  ): Promise<LanguageResponseDto> {
    const profile = await this.requireProfile(userId);
    const name = dto.name.trim();
    await this.assertNameAvailable(profile.id, name);

    const language = this.languagesRepository.create({
      profileId: profile.id,
      name,
      proficiency: dto.proficiency,
    });

    return this.toResponse(await this.languagesRepository.save(language));
  }

  /** GET /v1/me/languages */
  async findAll(userId: string): Promise<LanguageResponseDto[]> {
    const profile = await this.requireProfile(userId);
    const languages = await this.languagesRepository.find({
      where: { profileId: profile.id },
      order: { name: 'ASC', id: 'ASC' },
    });

    return languages.map((language) => this.toResponse(language));
  }

  /** GET /v1/me/languages/:id */
  async findOne(
    userId: string,
    languageId: string,
  ): Promise<LanguageResponseDto> {
    const profile = await this.requireProfile(userId);
    const language = await this.requireOwnedLanguage(profile.id, languageId);

    return this.toResponse(language);
  }

  /** PATCH /v1/me/languages/:id */
  async update(
    userId: string,
    languageId: string,
    dto: UpdateLanguageDto,
  ): Promise<LanguageResponseDto> {
    const profile = await this.requireProfile(userId);
    const language = await this.requireOwnedLanguage(profile.id, languageId);
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    const name =
      hasField(dto, 'name') && dto.name !== undefined
        ? dto.name.trim()
        : language.name;
    await this.assertNameAvailable(profile.id, name, language.id);

    if (hasField(dto, 'name') && dto.name !== undefined) {
      language.name = name;
    }
    if (hasField(dto, 'proficiency') && dto.proficiency !== undefined) {
      language.proficiency = dto.proficiency;
    }

    return this.toResponse(await this.languagesRepository.save(language));
  }

  /** DELETE /v1/me/languages/:id */
  async remove(userId: string, languageId: string): Promise<void> {
    const profile = await this.requireProfile(userId);
    await this.requireOwnedLanguage(profile.id, languageId);

    await this.languagesRepository.delete({
      id: languageId,
      profileId: profile.id,
    });
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

  private async requireOwnedLanguage(
    profileId: string,
    languageId: string,
  ): Promise<Language> {
    const language = await this.languagesRepository.findOne({
      where: { id: languageId, profileId },
    });

    if (!language) {
      throw new NotFoundException('Language not found');
    }

    return language;
  }

  private async assertNameAvailable(
    profileId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    // Não existe UNIQUE em languages.name: a regra é do service. A corrida
    // entre duas requisições é risco conhecido — sem migration nesta sprint.
    const existing = await this.languagesRepository.findBy({ profileId });
    const candidate = normalizeText(name);

    if (
      existing.some(
        (item) =>
          item.id !== excludeId && normalizeText(item.name) === candidate,
      )
    ) {
      throw new ConflictException('Language already registered in profile');
    }
  }

  private toResponse(language: Language): LanguageResponseDto {
    return {
      id: language.id,
      profileId: language.profileId,
      name: language.name,
      proficiency: language.proficiency,
      createdAt: language.createdAt,
      updatedAt: language.updatedAt,
    };
  }
}
