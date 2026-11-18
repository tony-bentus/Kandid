import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindManyOptions, FindOneOptions } from 'typeorm';
import { Profile } from '../profiles/entities/profile.entity.js';
import type { CreateEducationDto } from './dto/create-education.dto.js';
import type { UpdateEducationDto } from './dto/update-education.dto.js';
import { EducationsService } from './educations.service.js';
import { Education } from './entities/education.entity.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const EDUCATION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CREATED_AT = new Date('2026-11-09T12:00:00.000Z');

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({ id: PROFILE_ID, userId: USER_ID, ...overrides }) as Profile;

const makeEducation = (overrides: Partial<Education> = {}): Education =>
  ({
    id: EDUCATION_ID,
    profileId: PROFILE_ID,
    institution: 'USP',
    degree: 'Bacharelado',
    fieldOfStudy: 'Ciência da Computação',
    startDate: '2018-02-01',
    endDate: '2022-12-15',
    isCurrent: false,
    description: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }) as Education;

const validDto = {
  institution: 'USP',
  degree: 'Bacharelado',
  fieldOfStudy: 'Ciência da Computação',
  startDate: '2018-02-01',
  endDate: '2022-12-15',
  isCurrent: false,
} satisfies CreateEducationDto;

describe('EducationsService', () => {
  const educationsRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Education>) => Promise<Education | null>
    >(),
    find: vi.fn<(options: FindManyOptions<Education>) => Promise<Education[]>>(),
    create: vi.fn<(input: Partial<Education>) => Education>(),
    save: vi.fn<(education: Education) => Promise<Education>>(),
    delete: vi.fn<(criteria: object) => Promise<void>>(),
  };
  const profilesRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Profile>) => Promise<Profile | null>
    >(),
  };

  let service: EducationsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    profilesRepository.findOne.mockResolvedValue(makeProfile());
    educationsRepository.findOne.mockResolvedValue(makeEducation());
    educationsRepository.find.mockResolvedValue([]);
    educationsRepository.create.mockImplementation((input) =>
      makeEducation(input),
    );
    educationsRepository.save.mockImplementation(async (education) => education);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EducationsService,
        {
          provide: getRepositoryToken(Education),
          useValue: educationsRepository,
        },
        { provide: getRepositoryToken(Profile), useValue: profilesRepository },
      ],
    }).compile();

    service = moduleRef.get(EducationsService);
  });

  describe('create', () => {
    it('returns 404 when the user has no profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(USER_ID, validDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(profilesRepository.findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(educationsRepository.create).not.toHaveBeenCalled();
    });

    it('creates scoped to the profile and maps the public response', async () => {
      const result = await service.create(USER_ID, validDto);

      expect(educationsRepository.create).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
        ...validDto,
        description: null,
      });
      expect(educationsRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: EDUCATION_ID,
        profileId: PROFILE_ID,
        institution: validDto.institution,
        degree: validDto.degree,
        fieldOfStudy: validDto.fieldOfStudy,
        startDate: validDto.startDate,
        endDate: validDto.endDate,
        isCurrent: false,
        description: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });
      expect(result).not.toHaveProperty('userId');
    });

    it('rejects isCurrent=true with an endDate', async () => {
      await expect(
        service.create(USER_ID, { ...validDto, isCurrent: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });

    it('rejects isCurrent=false without an endDate', async () => {
      const request = service.create(USER_ID, {
        ...validDto,
        endDate: undefined,
      });

      await expect(request).rejects.toBeInstanceOf(BadRequestException);
      await expect(request).rejects.toThrow('endDate');
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an endDate before the startDate', async () => {
      await expect(
        service.create(USER_ID, {
          ...validDto,
          startDate: '2022-01-01',
          endDate: '2021-12-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns 404 without a profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findAll(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(educationsRepository.find).not.toHaveBeenCalled();
    });

    it('lists only the profile records ordered by startDate DESC, id ASC', async () => {
      const newer = makeEducation({ id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' });
      const older = makeEducation({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' });
      educationsRepository.find.mockResolvedValueOnce([newer, older]);

      const result = await service.findAll(USER_ID);

      expect(educationsRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        order: { startDate: 'DESC', id: 'ASC' },
      });
      expect(result.map((item) => item.id)).toEqual([newer.id, older.id]);
    });
  });

  describe('findOne', () => {
    it('queries by id and profile id and returns 404 for another user', async () => {
      educationsRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne(USER_ID, EDUCATION_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(educationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: EDUCATION_ID, profileId: PROFILE_ID },
      });
    });

    it('returns the mapped record when it belongs to the user', async () => {
      const result = await service.findOne(USER_ID, EDUCATION_ID);

      expect(result).toMatchObject({
        id: EDUCATION_ID,
        profileId: PROFILE_ID,
        institution: 'USP',
      });
    });
  });

  describe('update', () => {
    it('returns 404 for a record of another user', async () => {
      educationsRepository.findOne.mockResolvedValueOnce(null);
      const dto: UpdateEducationDto = { degree: 'Mestrado' };

      await expect(
        service.update(USER_ID, EDUCATION_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });

    it('applies only the fields present in the patch', async () => {
      const existing = makeEducation();
      educationsRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.update(USER_ID, EDUCATION_ID, {
        degree: 'Mestrado',
      });

      expect(educationsRepository.save).toHaveBeenCalledWith(existing);
      expect(result.degree).toBe('Mestrado');
      expect(result.institution).toBe('USP');
      expect(result.startDate).toBe('2018-02-01');
      expect(result.endDate).toBe('2022-12-15');
    });

    it.each([
      'institution',
      'degree',
      'fieldOfStudy',
      'startDate',
      'isCurrent',
    ] as const)(
      'rejects null in %s',
      async (field) => {
        const dto = { [field]: null } as unknown as UpdateEducationDto;

        await expect(
          service.update(USER_ID, EDUCATION_ID, dto),
        ).rejects.toThrow(`${field} cannot be null`);
        expect(educationsRepository.save).not.toHaveBeenCalled();
      },
    );

    it('revalidates dates after the merge', async () => {
      await expect(
        service.update(USER_ID, EDUCATION_ID, { endDate: '2017-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an endDate added to a current education', async () => {
      educationsRepository.findOne.mockResolvedValueOnce(
        makeEducation({ endDate: null, isCurrent: true }),
      );

      await expect(
        service.update(USER_ID, EDUCATION_ID, { endDate: '2023-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(educationsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('returns 404 for another user without deleting anything', async () => {
      educationsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(USER_ID, EDUCATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(educationsRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes only through the education repository, scoped by profile', async () => {
      await service.remove(USER_ID, EDUCATION_ID);

      expect(educationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: EDUCATION_ID, profileId: PROFILE_ID },
      });
      expect(educationsRepository.delete).toHaveBeenCalledTimes(1);
      expect(educationsRepository.delete).toHaveBeenCalledWith({
        id: EDUCATION_ID,
        profileId: PROFILE_ID,
      });
      expect(profilesRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
