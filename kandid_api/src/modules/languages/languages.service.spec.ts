import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindManyOptions, FindOneOptions } from 'typeorm';
import { LanguageProficiency } from '../../common/enums/language-proficiency.enum.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import type { CreateLanguageDto } from './dto/create-language.dto.js';
import type { UpdateLanguageDto } from './dto/update-language.dto.js';
import { LanguagesService } from './languages.service.js';
import { Language } from './entities/language.entity.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const LANGUAGE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_LANGUAGE_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CREATED_AT = new Date('2026-11-09T12:00:00.000Z');

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({ id: PROFILE_ID, userId: USER_ID, ...overrides }) as Profile;

const makeLanguage = (overrides: Partial<Language> = {}): Language =>
  ({
    id: LANGUAGE_ID,
    profileId: PROFILE_ID,
    name: 'Inglês',
    proficiency: LanguageProficiency.FLUENT,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }) as Language;

const validDto = {
  name: 'Inglês',
  proficiency: LanguageProficiency.ADVANCED,
} satisfies CreateLanguageDto;

describe('LanguagesService', () => {
  const languagesRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Language>) => Promise<Language | null>
    >(),
    find: vi.fn<(options: FindManyOptions<Language>) => Promise<Language[]>>(),
    findBy: vi.fn<
      (where: { profileId: string }) => Promise<Language[]>
    >(),
    create: vi.fn<(input: Partial<Language>) => Language>(),
    save: vi.fn<(language: Language) => Promise<Language>>(),
    delete: vi.fn<(criteria: object) => Promise<void>>(),
  };
  const profilesRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Profile>) => Promise<Profile | null>
    >(),
  };

  let service: LanguagesService;

  beforeEach(async () => {
    vi.resetAllMocks();
    profilesRepository.findOne.mockResolvedValue(makeProfile());
    languagesRepository.findOne.mockResolvedValue(makeLanguage());
    languagesRepository.findBy.mockResolvedValue([]);
    languagesRepository.find.mockResolvedValue([]);
    languagesRepository.create.mockImplementation((input) => makeLanguage(input));
    languagesRepository.save.mockImplementation(async (language) => language);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagesService,
        {
          provide: getRepositoryToken(Language),
          useValue: languagesRepository,
        },
        { provide: getRepositoryToken(Profile), useValue: profilesRepository },
      ],
    }).compile();

    service = moduleRef.get(LanguagesService);
  });

  describe('create', () => {
    it('returns 404 when the user has no profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(USER_ID, validDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(languagesRepository.findBy).not.toHaveBeenCalled();
      expect(languagesRepository.create).not.toHaveBeenCalled();
    });

    it('persists the trimmed name scoped to the profile', async () => {
      const result = await service.create(USER_ID, {
        ...validDto,
        name: '  Inglês  ',
      });

      expect(languagesRepository.findBy).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
      });
      expect(languagesRepository.create).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
        name: 'Inglês',
        proficiency: LanguageProficiency.ADVANCED,
      });
      expect(languagesRepository.save).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Inglês');
      expect(result).not.toHaveProperty('userId');
    });

    it('rejects a duplicate name ignoring case and accents', async () => {
      languagesRepository.findBy.mockResolvedValueOnce([
        makeLanguage({ id: OTHER_LANGUAGE_ID, name: 'Inglês' }),
      ]);

      await expect(
        service.create(USER_ID, { ...validDto, name: 'ingles' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(languagesRepository.create).not.toHaveBeenCalled();
      expect(languagesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns 404 without a profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findAll(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(languagesRepository.find).not.toHaveBeenCalled();
    });

    it('lists only the profile records ordered by name ASC, id ASC', async () => {
      const first = makeLanguage({
        id: OTHER_LANGUAGE_ID,
        name: 'Alemanha',
      });
      const second = makeLanguage({ name: 'Inglês' });
      languagesRepository.find.mockResolvedValueOnce([first, second]);

      const result = await service.findAll(USER_ID);

      expect(languagesRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        order: { name: 'ASC', id: 'ASC' },
      });
      expect(result.map((item) => item.id)).toEqual([first.id, second.id]);
    });
  });

  describe('findOne', () => {
    it('queries by id and profile id and returns 404 for another user', async () => {
      languagesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne(USER_ID, LANGUAGE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(languagesRepository.findOne).toHaveBeenCalledWith({
        where: { id: LANGUAGE_ID, profileId: PROFILE_ID },
      });
    });

    it('returns the mapped record when it belongs to the user', async () => {
      const result = await service.findOne(USER_ID, LANGUAGE_ID);

      expect(result).toMatchObject({
        id: LANGUAGE_ID,
        profileId: PROFILE_ID,
        name: 'Inglês',
        proficiency: LanguageProficiency.FLUENT,
      });
    });
  });

  describe('update', () => {
    it('returns 404 for a record of another user', async () => {
      languagesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(USER_ID, LANGUAGE_ID, { name: 'Francês' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(languagesRepository.save).not.toHaveBeenCalled();
    });

    it('applies only the fields present in the patch', async () => {
      const existing = makeLanguage();
      languagesRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.update(USER_ID, LANGUAGE_ID, {
        proficiency: LanguageProficiency.NATIVE,
      });

      expect(languagesRepository.save).toHaveBeenCalledWith(existing);
      expect(result.proficiency).toBe(LanguageProficiency.NATIVE);
      expect(result.name).toBe('Inglês');
    });

    it('rejects a duplicate name ignoring case and accents', async () => {
      languagesRepository.findBy.mockResolvedValueOnce([
        makeLanguage({ name: 'Inglês' }),
        makeLanguage({ id: OTHER_LANGUAGE_ID, name: 'Espanhol' }),
      ]);

      await expect(
        service.update(USER_ID, LANGUAGE_ID, { name: '  espanhol ' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(languagesRepository.save).not.toHaveBeenCalled();
    });

    it('does not conflict with its own normalized name', async () => {
      languagesRepository.findBy.mockResolvedValueOnce([
        makeLanguage({ name: 'Inglês' }),
      ]);

      const result = await service.update(USER_ID, LANGUAGE_ID, {
        name: 'ingles',
      });

      expect(languagesRepository.save).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('ingles');
    });

    it.each(['name', 'proficiency'] as const)(
      'rejects null in %s',
      async (field) => {
        const dto = { [field]: null } as unknown as UpdateLanguageDto;

        await expect(
          service.update(USER_ID, LANGUAGE_ID, dto),
        ).rejects.toThrow(`${field} cannot be null`);
        expect(languagesRepository.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('remove', () => {
    it('returns 404 for another user without deleting anything', async () => {
      languagesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(USER_ID, LANGUAGE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(languagesRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes only through the language repository, scoped by profile', async () => {
      await service.remove(USER_ID, LANGUAGE_ID);

      expect(languagesRepository.findOne).toHaveBeenCalledWith({
        where: { id: LANGUAGE_ID, profileId: PROFILE_ID },
      });
      expect(languagesRepository.delete).toHaveBeenCalledTimes(1);
      expect(languagesRepository.delete).toHaveBeenCalledWith({
        id: LANGUAGE_ID,
        profileId: PROFILE_ID,
      });
      expect(profilesRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
