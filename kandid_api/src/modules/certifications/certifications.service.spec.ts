import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindManyOptions, FindOneOptions } from 'typeorm';
import { Profile } from '../profiles/entities/profile.entity.js';
import type { CreateCertificationDto } from './dto/create-certification.dto.js';
import type { UpdateCertificationDto } from './dto/update-certification.dto.js';
import { CertificationsService } from './certifications.service.js';
import { Certification } from './entities/certification.entity.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const CERTIFICATION_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CREATED_AT = new Date('2026-11-09T12:00:00.000Z');

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({ id: PROFILE_ID, userId: USER_ID, ...overrides }) as Profile;

const makeCertification = (
  overrides: Partial<Certification> = {},
): Certification =>
  ({
    id: CERTIFICATION_ID,
    profileId: PROFILE_ID,
    name: 'AWS Certified Solutions Architect',
    issuer: 'Amazon Web Services',
    issueDate: '2024-03-10',
    expiryDate: '2027-03-10',
    credentialUrl: null,
    credentialId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  }) as Certification;

const validDto = {
  name: 'AWS Certified Solutions Architect',
  issuer: 'Amazon Web Services',
  issueDate: '2024-03-10',
  expiryDate: '2027-03-10',
} satisfies CreateCertificationDto;

describe('CertificationsService', () => {
  const certificationsRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Certification>) => Promise<Certification | null>
    >(),
    find: vi.fn<
      (options: FindManyOptions<Certification>) => Promise<Certification[]>
    >(),
    create: vi.fn<(input: Partial<Certification>) => Certification>(),
    save: vi.fn<(certification: Certification) => Promise<Certification>>(),
    delete: vi.fn<(criteria: object) => Promise<void>>(),
  };
  const profilesRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Profile>) => Promise<Profile | null>
    >(),
  };

  let service: CertificationsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    profilesRepository.findOne.mockResolvedValue(makeProfile());
    certificationsRepository.findOne.mockResolvedValue(makeCertification());
    certificationsRepository.find.mockResolvedValue([]);
    certificationsRepository.create.mockImplementation((input) =>
      makeCertification(input),
    );
    certificationsRepository.save.mockImplementation(
      async (certification) => certification,
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationsService,
        {
          provide: getRepositoryToken(Certification),
          useValue: certificationsRepository,
        },
        { provide: getRepositoryToken(Profile), useValue: profilesRepository },
      ],
    }).compile();

    service = moduleRef.get(CertificationsService);
  });

  describe('create', () => {
    it('returns 404 when the user has no profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(USER_ID, validDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(certificationsRepository.create).not.toHaveBeenCalled();
    });

    it('creates scoped to the profile and maps the public response', async () => {
      const result = await service.create(USER_ID, validDto);

      expect(certificationsRepository.create).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
        ...validDto,
        credentialUrl: null,
        credentialId: null,
      });
      expect(certificationsRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: CERTIFICATION_ID,
        profileId: PROFILE_ID,
        name: validDto.name,
        issuer: validDto.issuer,
        issueDate: validDto.issueDate,
        expiryDate: validDto.expiryDate,
        credentialUrl: null,
        credentialId: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      });
      expect(result).not.toHaveProperty('userId');
    });

    it('rejects expiryDate before issueDate', async () => {
      await expect(
        service.create(USER_ID, {
          ...validDto,
          issueDate: '2024-03-10',
          expiryDate: '2024-03-09',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(certificationsRepository.save).not.toHaveBeenCalled();
    });

    it('allows an already expired certification as history', async () => {
      const result = await service.create(USER_ID, {
        ...validDto,
        issueDate: '2020-01-01',
        expiryDate: '2021-01-01',
      });

      expect(certificationsRepository.save).toHaveBeenCalledTimes(1);
      expect(result.issueDate).toBe('2020-01-01');
      expect(result.expiryDate).toBe('2021-01-01');
    });
  });

  describe('findAll', () => {
    it('returns 404 without a profile', async () => {
      profilesRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findAll(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(certificationsRepository.find).not.toHaveBeenCalled();
    });

    it('lists only the profile records ordered by issueDate DESC, id ASC', async () => {
      const newer = makeCertification({
        id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        issueDate: '2025-01-01',
      });
      const older = makeCertification({
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        issueDate: '2024-01-01',
      });
      certificationsRepository.find.mockResolvedValueOnce([newer, older]);

      const result = await service.findAll(USER_ID);

      expect(certificationsRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        order: { issueDate: 'DESC', id: 'ASC' },
      });
      expect(result.map((item) => item.id)).toEqual([newer.id, older.id]);
    });
  });

  describe('findOne', () => {
    it('queries by id and profile id and returns 404 for another user', async () => {
      certificationsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findOne(USER_ID, CERTIFICATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(certificationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: CERTIFICATION_ID, profileId: PROFILE_ID },
      });
    });

    it('returns the mapped record when it belongs to the user', async () => {
      const result = await service.findOne(USER_ID, CERTIFICATION_ID);

      expect(result).toMatchObject({
        id: CERTIFICATION_ID,
        profileId: PROFILE_ID,
        name: validDto.name,
      });
    });
  });

  describe('update', () => {
    it('returns 404 for a record of another user', async () => {
      certificationsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.update(USER_ID, CERTIFICATION_ID, { issuer: 'Outro emissor' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(certificationsRepository.save).not.toHaveBeenCalled();
    });

    it('applies only the fields present in the patch', async () => {
      const existing = makeCertification();
      certificationsRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.update(USER_ID, CERTIFICATION_ID, {
        issuer: 'Outro emissor',
      });

      expect(certificationsRepository.save).toHaveBeenCalledWith(existing);
      expect(result.issuer).toBe('Outro emissor');
      expect(result.name).toBe(validDto.name);
      expect(result.issueDate).toBe(validDto.issueDate);
    });

    it.each(['name', 'issuer', 'issueDate'] as const)(
      'rejects null in %s',
      async (field) => {
        const dto = { [field]: null } as unknown as UpdateCertificationDto;

        await expect(
          service.update(USER_ID, CERTIFICATION_ID, dto),
        ).rejects.toThrow(`${field} cannot be null`);
        expect(certificationsRepository.save).not.toHaveBeenCalled();
      },
    );

    it('revalidates the expiry order after the merge', async () => {
      await expect(
        service.update(USER_ID, CERTIFICATION_ID, { issueDate: '2028-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(certificationsRepository.save).not.toHaveBeenCalled();
    });

    it('keeps allowing an expired certification on update', async () => {
      certificationsRepository.findOne.mockResolvedValueOnce(
        makeCertification({
          issueDate: '2020-01-01',
          expiryDate: '2021-01-01',
        }),
      );

      const result = await service.update(USER_ID, CERTIFICATION_ID, {
        expiryDate: '2022-01-01',
      });

      expect(certificationsRepository.save).toHaveBeenCalledTimes(1);
      expect(result.expiryDate).toBe('2022-01-01');
    });
  });

  describe('remove', () => {
    it('returns 404 for another user without deleting anything', async () => {
      certificationsRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(USER_ID, CERTIFICATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(certificationsRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes only through the certification repository, scoped by profile', async () => {
      await service.remove(USER_ID, CERTIFICATION_ID);

      expect(certificationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: CERTIFICATION_ID, profileId: PROFILE_ID },
      });
      expect(certificationsRepository.delete).toHaveBeenCalledTimes(1);
      expect(certificationsRepository.delete).toHaveBeenCalledWith({
        id: CERTIFICATION_ID,
        profileId: PROFILE_ID,
      });
      expect(profilesRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });
});
