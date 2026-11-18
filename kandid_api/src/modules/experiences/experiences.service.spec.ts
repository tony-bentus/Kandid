import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { Experience } from './entities/experience.entity.js';
import { ExperienceBullet } from './entities/experience-bullet.entity.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { ExperiencesService } from './experiences.service.js';
import type { CreateExperienceDto } from './dto/create-experience.dto.js';
import type { UpdateExperienceBulletDto } from './dto/update-experience-bullet.dto.js';
import type { UpdateExperienceDto } from './dto/update-experience.dto.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const EXPERIENCE_ID = '33333333-3333-4333-8333-333333333333';
const BULLET_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_EXPERIENCE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_BULLET_ID = '66666666-6666-4666-8666-666666666666';

type ExperienceWithBullets = Experience & { bullets?: ExperienceBullet[] };

const makeProfile = (): Profile =>
  Object.assign(new Profile(), { id: PROFILE_ID, userId: USER_ID });

const makeBullet = (overrides: Partial<ExperienceBullet> = {}): ExperienceBullet =>
  Object.assign(new ExperienceBullet(), {
    id: BULLET_ID,
    experienceId: EXPERIENCE_ID,
    text: 'Reduzi a latência da API em 40%.',
    sortOrder: 0,
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    ...overrides,
  });

const makeExperience = (
  overrides: Partial<ExperienceWithBullets> = {},
): ExperienceWithBullets =>
  Object.assign(new Experience(), {
    id: EXPERIENCE_ID,
    profileId: PROFILE_ID,
    companyName: 'Acme',
    role: 'Backend Developer',
    employmentType: null,
    workModel: null,
    location: null,
    startDate: '2023-01-01',
    endDate: null,
    isCurrent: true,
    description: null,
    sortOrder: 0,
    bullets: [],
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    ...overrides,
  });

const validCreate = (
  overrides: Partial<CreateExperienceDto> = {},
): CreateExperienceDto => ({
  companyName: 'Acme',
  role: 'Backend Developer',
  startDate: '2023-01-01',
  isCurrent: true,
  ...overrides,
});

describe('ExperiencesService', () => {
  const experiencesRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Experience>) => Promise<ExperienceWithBullets | null>
    >(),
    find: vi.fn<
      (options: FindManyOptions<Experience>) => Promise<ExperienceWithBullets[]>
    >(),
    create: vi.fn<(input: Partial<Experience>) => ExperienceWithBullets>(),
    save: vi.fn<(entity: Experience) => Promise<ExperienceWithBullets>>(),
    remove: vi.fn<(entity: Experience) => Promise<ExperienceWithBullets>>(),
  };
  const bulletsRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<ExperienceBullet>) => Promise<ExperienceBullet | null>
    >(),
    find: vi.fn<
      (options: FindManyOptions<ExperienceBullet>) => Promise<ExperienceBullet[]>
    >(),
    create: vi.fn<(input: Partial<ExperienceBullet>) => ExperienceBullet>(),
    save: vi.fn<(entity: ExperienceBullet) => Promise<ExperienceBullet>>(),
    remove: vi.fn<(entity: ExperienceBullet) => Promise<ExperienceBullet>>(),
  };
  const profilesRepository = {
    findOne: vi.fn<(options: FindOneOptions<Profile>) => Promise<Profile | null>>(),
  };

  let service: ExperiencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    profilesRepository.findOne.mockResolvedValue(makeProfile());
    experiencesRepository.find.mockResolvedValue([]);
    bulletsRepository.find.mockResolvedValue([]);
    experiencesRepository.create.mockImplementation((input) =>
      Object.assign(new Experience(), input),
    );
    experiencesRepository.save.mockImplementation(async (entity) => entity);
    bulletsRepository.create.mockImplementation((input) =>
      Object.assign(new ExperienceBullet(), input),
    );
    bulletsRepository.save.mockImplementation(async (entity) => entity);

    service = new ExperiencesService(
      experiencesRepository as unknown as Repository<Experience>,
      bulletsRepository as unknown as Repository<ExperienceBullet>,
      profilesRepository as unknown as Repository<Profile>,
    );
  });

  describe('ownership', () => {
    it('returns 404 and does not persist when the user has no profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(USER_ID, validCreate())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(profilesRepository.findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(experiencesRepository.create).not.toHaveBeenCalled();
    });

    it('returns 404 for a foreign or missing experience on get', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findOne(USER_ID, OTHER_EXPERIENCE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(experiencesRepository.findOne).toHaveBeenCalledWith({
        where: { id: OTHER_EXPERIENCE_ID, profileId: PROFILE_ID },
      });
    });

    it('returns 404 for a foreign experience on patch without saving', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(USER_ID, OTHER_EXPERIENCE_ID, { role: 'Staff Engineer' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(experiencesRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 for a foreign experience on delete without removing', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(USER_ID, OTHER_EXPERIENCE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(experiencesRepository.remove).not.toHaveBeenCalled();
    });

    it('validates the experience before writing a bullet', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.addBullet(USER_ID, OTHER_EXPERIENCE_ID, { text: 'Conquista' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bulletsRepository.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the bullet id belongs to another experience', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
      bulletsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateBullet(USER_ID, EXPERIENCE_ID, OTHER_BULLET_ID, {
          text: 'Outra conquista',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bulletsRepository.findOne).toHaveBeenCalledWith({
        where: { id: OTHER_BULLET_ID, experienceId: EXPERIENCE_ID },
      });
      expect(bulletsRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 when removing a bullet from the wrong experience', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
      bulletsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.removeBullet(USER_ID, EXPERIENCE_ID, OTHER_BULLET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bulletsRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('date rules', () => {
    it('rejects isCurrent=true with an endDate', async () => {
      await expect(
        service.create(
          USER_ID,
          validCreate({ endDate: '2025-06-30', isCurrent: true }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(experiencesRepository.create).not.toHaveBeenCalled();
    });

    it('rejects isCurrent=false without an endDate with a clear message', async () => {
      await expect(
        service.create(USER_ID, validCreate({ isCurrent: false })),
      ).rejects.toThrow(/endDate/);
      expect(experiencesRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an endDate before the startDate', async () => {
      await expect(
        service.create(
          USER_ID,
          validCreate({ isCurrent: false, endDate: '2022-12-31' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(experiencesRepository.create).not.toHaveBeenCalled();
    });

    it('accepts only companyName, role and startDate as current by default', async () => {
      const result = await service.create(USER_ID, {
        companyName: 'Acme',
        role: 'Backend Developer',
        startDate: '2023-01-01',
      });

      expect(experiencesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isCurrent: true, endDate: null }),
      );
      expect(result.bullets).toEqual([]);
    });

    it('revalidates dates after a partial update merge', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());

      await expect(
        service.update(USER_ID, EXPERIENCE_ID, { endDate: '2024-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(experiencesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a patch that clears the required endDate of a past experience', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(
        makeExperience({ isCurrent: false, endDate: '2024-12-31' }),
      );

      await expect(
        service.update(USER_ID, EXPERIENCE_ID, {
          isCurrent: false,
          endDate: null,
        } as unknown as UpdateExperienceDto),
      ).rejects.toThrow(/endDate/);
      expect(experiencesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a patch whose new startDate is after the persisted endDate', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(
        makeExperience({ isCurrent: false, endDate: '2024-12-31' }),
      );

      await expect(
        service.update(USER_ID, EXPERIENCE_ID, { startDate: '2025-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(experiencesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('sortOrder defaults', () => {
    it('uses MAX(sort_order) + 1 for experiences created without sortOrder', async () => {
      experiencesRepository.find.mockResolvedValueOnce([
        makeExperience({ sortOrder: 4 }),
      ]);

      await service.create(USER_ID, validCreate());

      expect(experiencesRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        order: { sortOrder: 'DESC' },
        take: 1,
      });
      expect(experiencesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 5 }),
      );
    });

    it('starts at 0 when the profile has no experiences', async () => {
      await service.create(USER_ID, validCreate());

      expect(experiencesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });

    it('uses MAX(sort_order) + 1 for bullets created without sortOrder', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
      bulletsRepository.find.mockResolvedValueOnce([
        makeBullet({ sortOrder: 2 }),
      ]);

      await service.addBullet(USER_ID, EXPERIENCE_ID, { text: 'Conquista' });

      expect(bulletsRepository.find).toHaveBeenCalledWith({
        where: { experienceId: EXPERIENCE_ID },
        order: { sortOrder: 'DESC' },
        take: 1,
      });
      expect(bulletsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ experienceId: EXPERIENCE_ID, sortOrder: 3 }),
      );
    });
  });

  describe('listing and mapping', () => {
    it('returns only the profile experiences ordered, with sorted bullets', async () => {
      experiencesRepository.find.mockResolvedValueOnce([
        makeExperience({ sortOrder: 0, startDate: '2023-01-01' }),
        makeExperience({
          id: OTHER_EXPERIENCE_ID,
          sortOrder: 1,
          startDate: '2020-01-01',
        }),
      ]);
      bulletsRepository.find.mockResolvedValueOnce([
        makeBullet({
          id: OTHER_BULLET_ID,
          experienceId: OTHER_EXPERIENCE_ID,
          sortOrder: 2,
        }),
        makeBullet({
          id: BULLET_ID,
          experienceId: OTHER_EXPERIENCE_ID,
          sortOrder: 0,
        }),
      ]);

      const result = await service.findAll(USER_ID);

      expect(experiencesRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        order: { sortOrder: 'ASC', startDate: 'DESC', id: 'ASC' },
      });
      expect(bulletsRepository.find).toHaveBeenCalledWith({
        where: { experienceId: expect.anything() },
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: EXPERIENCE_ID,
        profileId: PROFILE_ID,
        sortOrder: 0,
        bullets: [],
      });
      expect(result[1]?.bullets.map((bullet) => bullet.id)).toEqual([
        BULLET_ID,
        OTHER_BULLET_ID,
      ]);
      expect(result[1]?.bullets[0]).toMatchObject({
        id: BULLET_ID,
        experienceId: OTHER_EXPERIENCE_ID,
        text: 'Reduzi a latência da API em 40%.',
      });
    });
  });

  describe('null handling in updates', () => {
    it.each(['companyName', 'role', 'startDate', 'isCurrent', 'sortOrder'])(
      'rejects an explicit null in %s',
      async (field) => {
        experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
        const dto = { [field]: null } as unknown as UpdateExperienceDto;

        await expect(
          service.update(USER_ID, EXPERIENCE_ID, dto),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(experiencesRepository.save).not.toHaveBeenCalled();
      },
    );

    it.each(['text', 'sortOrder'])(
      'rejects an explicit null in bullet %s',
      async (field) => {
        experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
        bulletsRepository.findOne.mockResolvedValueOnce(makeBullet());

        await expect(
          service.updateBullet(USER_ID, EXPERIENCE_ID, BULLET_ID, {
            [field]: null,
          } as unknown as UpdateExperienceBulletDto),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(bulletsRepository.save).not.toHaveBeenCalled();
      },
    );

    it('clears optional fields when they are explicitly null', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(
        makeExperience({ location: 'Remoto', description: 'Descrição' }),
      );

      const result = await service.update(USER_ID, EXPERIENCE_ID, {
        location: null,
        description: null,
      } as unknown as UpdateExperienceDto);

      expect(result.location).toBeNull();
      expect(result.description).toBeNull();
      expect(experiencesRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('removal', () => {
    it('removes the owned experience through the experience repository', async () => {
      const experience = makeExperience();
      experiencesRepository.findOne.mockResolvedValueOnce(experience);

      await service.remove(USER_ID, EXPERIENCE_ID);

      expect(experiencesRepository.remove).toHaveBeenCalledWith(experience);
      expect(bulletsRepository.remove).not.toHaveBeenCalled();
    });

    it('removes an owned bullet through the bullet repository', async () => {
      experiencesRepository.findOne.mockResolvedValueOnce(makeExperience());
      const bullet = makeBullet();
      bulletsRepository.findOne.mockResolvedValueOnce(bullet);

      await service.removeBullet(USER_ID, EXPERIENCE_ID, BULLET_ID);

      expect(bulletsRepository.remove).toHaveBeenCalledWith(bullet);
      expect(experiencesRepository.remove).not.toHaveBeenCalled();
    });
  });
});
