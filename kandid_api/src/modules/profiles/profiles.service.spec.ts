import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  QueryFailedError,
  type DeepPartial,
  type FindOneOptions,
} from 'typeorm';
import { Seniority } from '../../common/enums/seniority.enum.js';
import { WorkModel } from '../../common/enums/work-model.enum.js';
import type { User } from '../users/entities/user.entity.js';
import { Profile } from './entities/profile.entity.js';
import { ProfilesService } from './profiles.service.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const TIMESTAMP = new Date('2026-11-10T12:00:00.000Z');

const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: PROFILE_ID,
  userId: USER_ID,
  // Dado sensível propositalmente presente na entidade: o mapper não pode
  // devolvê-lo na resposta.
  user: { id: USER_ID, passwordHash: 'secret-hash' } as unknown as User,
  headline: null,
  summary: null,
  phone: null,
  city: null,
  state: null,
  country: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  desiredRole: null,
  desiredSeniority: null,
  workModelPreference: null,
  desiredSalaryCents: null,
  currency: 'BRL',
  availableFrom: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
});

const queryFailed = (code: string, details: string): QueryFailedError =>
  new QueryFailedError(
    'INSERT INTO `profiles`',
    [],
    Object.assign(new Error('query failed'), { code, sqlMessage: details }),
  );

const duplicateError = (constraint: string): QueryFailedError =>
  queryFailed(
    'ER_DUP_ENTRY',
    `Duplicate entry '${USER_ID}' for key '${constraint}'`,
  );

describe('ProfilesService', () => {
  const repository = {
    findOne: vi.fn<
      (options: FindOneOptions<Profile>) => Promise<Profile | null>
    >(),
    create: vi.fn<(entityLike: DeepPartial<Profile>) => Profile>(),
    save: vi.fn<(profile: Profile) => Promise<Profile>>(),
  };

  let service: ProfilesService;

  beforeEach(async () => {
    vi.resetAllMocks();

    repository.create.mockImplementation((entityLike) =>
      makeProfile({
        ...(entityLike as Partial<Profile>),
        currency: undefined,
      }),
    );
    repository.save.mockImplementation((profile) => Promise.resolve(profile));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(Profile), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get<ProfilesService>(ProfilesService);
  });

  describe('getProfile', () => {
    it('retorna 404 sem perfil e não cria nada por efeito colateral', async () => {
      repository.findOne.mockResolvedValueOnce(null);

      const promise = service.getProfile(USER_ID);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toThrow('Profile not found');
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('converte centavos de string para número e preserva nulos sem expor dados de autenticação', async () => {
      repository.findOne.mockResolvedValueOnce(
        makeProfile({
          headline: 'Backend Developer',
          desiredSalaryCents: '1500000',
          desiredSeniority: Seniority.SENIOR,
          workModelPreference: WorkModel.REMOTE,
          availableFrom: '2026-12-01',
        }),
      );

      const result = await service.getProfile(USER_ID);

      expect(result).toEqual({
        id: PROFILE_ID,
        userId: USER_ID,
        headline: 'Backend Developer',
        summary: null,
        phone: null,
        city: null,
        state: null,
        country: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        desiredRole: null,
        desiredSeniority: Seniority.SENIOR,
        workModelPreference: WorkModel.REMOTE,
        desiredSalaryCents: 1500000,
        currency: 'BRL',
        availableFrom: '2026-12-01',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      });
      expect(result).not.toHaveProperty('user');
      expect(JSON.stringify(result)).not.toContain('secret-hash');
    });

    it('usa BRL quando a entidade não traz currency', async () => {
      repository.findOne.mockResolvedValueOnce(
        makeProfile({ currency: undefined as unknown as string }),
      );

      const result = await service.getProfile(USER_ID);

      expect(result.currency).toBe('BRL');
    });
  });

  describe('updateProfile', () => {
    it('cria o perfil com o userId do JWT e currency BRL', async () => {
      repository.findOne.mockResolvedValueOnce(null);

      const result = await service.updateProfile(USER_ID, {
        headline: 'Backend Developer',
      });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(repository.create).toHaveBeenCalledWith({ userId: USER_ID });
      const saved = repository.save.mock.calls[0][0];
      expect(saved.userId).toBe(USER_ID);
      expect(saved.currency).toBe('BRL');
      expect(saved.headline).toBe('Backend Developer');
      expect(result.userId).toBe(USER_ID);
      expect(result.currency).toBe('BRL');
    });

    it('no segundo PATCH altera somente o campo enviado', async () => {
      const existing = makeProfile({
        headline: 'Título antigo',
        summary: 'Resumo preservado',
        city: 'São Paulo',
        currency: 'USD',
      });
      repository.findOne.mockResolvedValueOnce(existing);

      await service.updateProfile(USER_ID, { headline: 'Novo título' });

      expect(repository.create).not.toHaveBeenCalled();
      expect(existing.headline).toBe('Novo título');
      expect(existing.summary).toBe('Resumo preservado');
      expect(existing.city).toBe('São Paulo');
      expect(existing.currency).toBe('USD');
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('null explícito limpa campo opcional e string vazia vira null', async () => {
      const existing = makeProfile({
        headline: 'Título antigo',
        summary: 'Resumo antigo',
        city: 'São Paulo',
      });
      repository.findOne.mockResolvedValueOnce(existing);

      await service.updateProfile(USER_ID, {
        headline: '  Novo título  ',
        summary: null as unknown as string,
        city: '   ',
      });

      expect(existing.headline).toBe('Novo título');
      expect(existing.summary).toBeNull();
      expect(existing.city).toBeNull();
    });

    it('persiste salário como string bigint e devolve número na resposta', async () => {
      repository.findOne.mockResolvedValueOnce(null);

      const result = await service.updateProfile(USER_ID, {
        desiredSalaryCents: 1500000,
      });

      expect(repository.save.mock.calls[0][0].desiredSalaryCents).toBe(
        '1500000',
      );
      expect(result.desiredSalaryCents).toBe(1500000);
    });

    it.each([-1, Number.MAX_SAFE_INTEGER + 1])(
      'rejeita desiredSalaryCents inválido (%s) com 400',
      async (value) => {
        repository.findOne.mockResolvedValueOnce(null);

        const promise = service.updateProfile(USER_ID, {
          desiredSalaryCents: value,
        });

        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toThrow(/desiredSalaryCents/);
        expect(repository.save).not.toHaveBeenCalled();
      },
    );

    it('rejeita null explícito em currency antes de consultar o banco', async () => {
      const promise = service.updateProfile(USER_ID, {
        currency: null as unknown as string,
      });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(/currency cannot be null/);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it.each([
      'REL_9e432b7df0d182f8d292902d1a',
      'user_id',
    ])('recarrega e reaplica o patch após ER_DUP_ENTRY (%s)', async (fragment) => {
      const reloaded = makeProfile({ headline: 'Título antigo' });
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(reloaded);
      repository.save
        .mockRejectedValueOnce(duplicateError(fragment))
        .mockResolvedValueOnce(reloaded);

      const result = await service.updateProfile(USER_ID, {
        headline: 'Novo título',
      });

      expect(repository.findOne).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(reloaded.headline).toBe('Novo título');
      expect(result.headline).toBe('Novo título');
    });

    it('não tenta mais de um retry após ER_DUP_ENTRY', async () => {
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeProfile());
      repository.save
        .mockRejectedValueOnce(duplicateError('user_id'))
        .mockRejectedValueOnce(duplicateError('user_id'));

      await expect(
        service.updateProfile(USER_ID, { headline: 'Novo título' }),
      ).rejects.toBeInstanceOf(QueryFailedError);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('propaga ER_DUP_ENTRY de constraint alheia sem recarregar', async () => {
      const error = duplicateError('UQ_users_email');
      repository.findOne.mockResolvedValueOnce(null);
      repository.save.mockRejectedValueOnce(error);

      await expect(
        service.updateProfile(USER_ID, { headline: 'Novo título' }),
      ).rejects.toBe(error);
      expect(repository.findOne).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('propaga QueryFailedError que não é ER_DUP_ENTRY', async () => {
      const error = queryFailed(
        'ER_LOCK_WAIT_TIMEOUT',
        'Lock wait timeout exceeded',
      );
      repository.findOne.mockResolvedValueOnce(null);
      repository.save.mockRejectedValueOnce(error);

      await expect(
        service.updateProfile(USER_ID, { headline: 'Novo título' }),
      ).rejects.toBe(error);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });
  });
});
