import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  QueryFailedError,
  type DataSource,
  type EntityManager,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { Certification } from '../certifications/entities/certification.entity.js';
import { Education } from '../educations/entities/education.entity.js';
import { Experience } from '../experiences/entities/experience.entity.js';
import { ExperienceBullet } from '../experiences/entities/experience-bullet.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Language } from '../languages/entities/language.entity.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { ProfileSkill } from '../skills/entities/profile-skill.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Resume } from './entities/resume.entity.js';
import { ResumeVersion } from './entities/resume-version.entity.js';
import { ResumesService } from './resumes.service.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const RESUME_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const OTHER_RESUME_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const JOB_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';

const NOW = new Date('2026-11-19T12:00:00.000Z');

const makeUser = (): User =>
  Object.assign(new User(), {
    id: USER_ID,
    name: 'Nome Sobrenome',
    email: 'email@exemplo.com',
  });

const makeProfile = (): Profile =>
  Object.assign(new Profile(), {
    id: PROFILE_ID,
    userId: USER_ID,
    desiredRole: 'Desenvolvedor Backend',
    desiredSeniority: null,
  });

const makeResume = (overrides: Partial<Resume> = {}): Resume =>
  Object.assign(new Resume(), {
    id: RESUME_ID,
    userId: USER_ID,
    name: 'Currículo Backend',
    targetRole: 'Desenvolvedor Backend Sênior',
    isDefault: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

const makeVersion = (overrides: Partial<ResumeVersion> = {}): ResumeVersion =>
  Object.assign(new ResumeVersion(), {
    id: '8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d',
    resumeId: RESUME_ID,
    version: 1,
    jobId: null,
    contentSnapshot: {
      schemaVersion: '1.0',
      targetRole: 'Desenvolvedor Backend Sênior',
      generatedAt: NOW.toISOString(),
      candidate: {},
      summary: '',
      skills: [],
      experiences: [],
      education: [],
      certifications: [],
      languages: [],
      projects: [],
    } as unknown as ResumeVersion['contentSnapshot'],
    atsScore: null,
    createdAt: NOW,
    ...overrides,
  });

const duplicateError = (constraint: string): QueryFailedError =>
  new QueryFailedError(
    'INSERT INTO resume_versions',
    [],
    Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      sqlMessage: `Duplicate entry 'x' for key '${constraint}'`,
    }),
  );

const maxVersionQueryBuilder = (maxVersion: number | null) => {
  const builder = {
    select: vi.fn(),
    where: vi.fn(),
    getRawOne: vi.fn().mockResolvedValue({ maxVersion }),
  };
  builder.select.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
};

describe('ResumesService', () => {
  const userRepository = {
    findOne: vi.fn<(options: FindOneOptions<User>) => Promise<User | null>>(),
  };
  const profileRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Profile>) => Promise<Profile | null>
    >(),
  };
  const resumeRepository = {
    existsBy: vi.fn<(where: FindOptionsWhere<Resume>) => Promise<boolean>>(),
    findOne: vi.fn<
      (options: FindOneOptions<Resume>) => Promise<Resume | null>
    >(),
    findAndCount: vi.fn(),
    create: vi.fn<(input: Partial<Resume>) => Resume>(),
    save: vi.fn<(entity: Resume) => Promise<Resume>>(),
    update: vi.fn<
      (
        criteria: FindOptionsWhere<Resume>,
        partial: Partial<Resume>,
      ) => Promise<unknown>
    >(),
    remove: vi.fn<(entity: Resume) => Promise<Resume>>(),
  };
  const versionRepository = {
    countBy: vi.fn<
      (where: FindOptionsWhere<ResumeVersion>) => Promise<number>
    >(),
    find: vi.fn<
      (options: FindManyOptions<ResumeVersion>) => Promise<ResumeVersion[]>
    >(),
    create: vi.fn<(input: Partial<ResumeVersion>) => ResumeVersion>(),
    save: vi.fn<(entity: ResumeVersion) => Promise<ResumeVersion>>(),
    createQueryBuilder: vi.fn(),
  };
  const experienceRepository = {
    find: vi.fn<
      (options: FindManyOptions<Experience>) => Promise<Experience[]>
    >(),
  };
  const bulletRepository = {
    find: vi.fn<
      (options: FindManyOptions<ExperienceBullet>) => Promise<ExperienceBullet[]>
    >(),
  };
  const profileSkillRepository = {
    find: vi.fn<
      (options: FindManyOptions<ProfileSkill>) => Promise<ProfileSkill[]>
    >(),
  };
  const educationRepository = {
    find: vi.fn<
      (options: FindManyOptions<Education>) => Promise<Education[]>
    >(),
  };
  const certificationRepository = {
    find: vi.fn<
      (options: FindManyOptions<Certification>) => Promise<Certification[]>
    >(),
  };
  const languageRepository = {
    find: vi.fn<(options: FindManyOptions<Language>) => Promise<Language[]>>(),
  };
  const jobRepository = {
    findOne: vi.fn<(options: FindOneOptions<Job>) => Promise<Job | null>>(),
  };

  const repositories = new Map<unknown, unknown>([
    [User, userRepository],
    [Profile, profileRepository],
    [Resume, resumeRepository],
    [ResumeVersion, versionRepository],
    [Experience, experienceRepository],
    [ExperienceBullet, bulletRepository],
    [ProfileSkill, profileSkillRepository],
    [Education, educationRepository],
    [Certification, certificationRepository],
    [Language, languageRepository],
    [Job, jobRepository],
  ]);

  const manager = {
    getRepository: (entity: unknown): unknown => {
      const repository = repositories.get(entity);
      if (repository === undefined) {
        throw new Error('Repository not mocked for entity');
      }
      return repository;
    },
  };

  const dataSource = {
    transaction: vi.fn(
      (run: (entityManager: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    ),
  };

  let service: ResumesService;

  beforeEach(() => {
    vi.resetAllMocks();

    dataSource.transaction.mockImplementation(
      (run: (entityManager: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    );

    userRepository.findOne.mockResolvedValue(makeUser());
    profileRepository.findOne.mockResolvedValue(makeProfile());
    jobRepository.findOne.mockResolvedValue(
      Object.assign(new Job(), { id: JOB_ID, userId: USER_ID }),
    );

    resumeRepository.existsBy.mockResolvedValue(false);
    resumeRepository.findOne.mockResolvedValue(null);
    resumeRepository.create.mockImplementation((input) => makeResume(input));
    resumeRepository.save.mockImplementation(async (entity) => entity);
    resumeRepository.update.mockResolvedValue({ affected: 1 });

    versionRepository.countBy.mockResolvedValue(0);
    versionRepository.create.mockImplementation((input) =>
      makeVersion(input),
    );
    versionRepository.save.mockImplementation(async (entity) => entity);

    experienceRepository.find.mockResolvedValue([]);
    bulletRepository.find.mockResolvedValue([]);
    profileSkillRepository.find.mockResolvedValue([]);
    educationRepository.find.mockResolvedValue([]);
    certificationRepository.find.mockResolvedValue([]);
    languageRepository.find.mockResolvedValue([]);

    service = new ResumesService(
      resumeRepository as unknown as Repository<Resume>,
      versionRepository as unknown as Repository<ResumeVersion>,
      dataSource as unknown as DataSource,
    );
  });

  describe('create', () => {
    it('makes the first resume default even when isDefault is false', async () => {
      resumeRepository.existsBy.mockResolvedValueOnce(false);

      const result = await service.create(USER_ID, {
        name: 'Currículo Backend',
        isDefault: false,
      });

      expect(result.isDefault).toBe(true);
      expect(resumeRepository.update).not.toHaveBeenCalled();
      expect(resumeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, isDefault: true }),
      );
    });

    it('clears the previous default in the same transaction when isDefault is true', async () => {
      resumeRepository.existsBy
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await service.create(USER_ID, {
        name: 'Currículo Frontend',
        isDefault: true,
      });

      expect(result.isDefault).toBe(true);
      expect(resumeRepository.update).toHaveBeenCalledWith(
        { userId: USER_ID },
        { isDefault: false },
      );
    });

    it('returns 409 for a duplicated resume name without saving', async () => {
      resumeRepository.existsBy
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.create(USER_ID, { name: 'Currículo Backend' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(resumeRepository.save).not.toHaveBeenCalled();
    });

    it('translates ER_DUP_ENTRY of UQ_resumes_user_name to 409', async () => {
      resumeRepository.existsBy.mockResolvedValue(false);
      resumeRepository.save.mockRejectedValueOnce(
        duplicateError('UQ_resumes_user_name'),
      );

      await expect(
        service.create(USER_ID, { name: 'Currículo Backend' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('ownership', () => {
    it('returns 404 for a foreign or missing resume', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findOne(USER_ID, OTHER_RESUME_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(resumeRepository.findOne).toHaveBeenCalledWith({
        where: { id: OTHER_RESUME_ID, userId: USER_ID },
      });
    });

    it('returns 404 when deleting a foreign resume without removing', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.remove(USER_ID, OTHER_RESUME_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(resumeRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('generateVersion', () => {
    it('numbers the next version as MAX(version) + 1 and keeps atsScore null', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(makeResume());
      versionRepository.createQueryBuilder.mockReturnValue(
        maxVersionQueryBuilder(2),
      );

      const result = await service.generateVersion(USER_ID, RESUME_ID, {});

      expect(versionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeId: RESUME_ID,
          version: 3,
          jobId: null,
          atsScore: null,
        }),
      );
      expect(result.version).toBe(3);
      expect(result.atsScore).toBeNull();
    });

    it('starts at version 1 when the resume has no versions', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(makeResume());
      versionRepository.createQueryBuilder.mockReturnValue(
        maxVersionQueryBuilder(null),
      );

      const result = await service.generateVersion(USER_ID, RESUME_ID, {});

      expect(result.version).toBe(1);
    });

    it('returns 404 for a foreign resume without creating a version', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.generateVersion(USER_ID, OTHER_RESUME_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(versionRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 for a foreign job without creating a version', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(makeResume());
      jobRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.generateVersion(USER_ID, RESUME_ID, { jobId: JOB_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(versionRepository.save).not.toHaveBeenCalled();
    });

    it('returns 409 after one retry when the version unique constraint still conflicts', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(makeResume());
      versionRepository.createQueryBuilder.mockReturnValue(
        maxVersionQueryBuilder(1),
      );
      versionRepository.save.mockRejectedValue(
        duplicateError('UQ_resume_versions_resume_version'),
      );

      await expect(
        service.generateVersion(USER_ID, RESUME_ID, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(versionRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove', () => {
    it('returns 409 when the resume has versions', async () => {
      resumeRepository.findOne.mockResolvedValueOnce(makeResume());
      versionRepository.countBy.mockResolvedValueOnce(1);

      await expect(
        service.remove(USER_ID, RESUME_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(resumeRepository.remove).not.toHaveBeenCalled();
    });
  });
});
