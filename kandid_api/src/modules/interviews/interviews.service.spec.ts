import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  QueryFailedError,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { InterviewOutcome } from '../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../common/enums/interview-status.enum.js';
import { InterviewType } from '../../common/enums/interview-type.enum.js';
import { Application } from '../applications/entities/application.entity.js';
import { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewResponseDto } from './dto/interview-response.dto.js';
import { UpdateInterviewDto } from './dto/update-interview.dto.js';
import { Interview } from './entities/interview.entity.js';
import { InterviewsService } from './interviews.service.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const APPLICATION_ID = '7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d';
const OTHER_APPLICATION_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const INTERVIEW_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
const OTHER_INTERVIEW_ID = '4e5f6a7b-8c9d-4e0f-8a1b-2c3d4e5f6a7b';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const SCHEDULED_AT = '2026-11-25T14:00:00.000Z';

const makeApplication = (id = APPLICATION_ID): Application =>
  Object.assign(new Application(), { id, userId: USER_ID });

const makeInterview = (overrides: Partial<Interview> = {}): Interview =>
  Object.assign(new Interview(), {
    id: INTERVIEW_ID,
    applicationId: APPLICATION_ID,
    round: 1,
    type: InterviewType.TECHNICAL,
    scheduledAt: new Date(SCHEDULED_AT),
    durationMinutes: 60,
    interviewerName: 'Maria Silva',
    interviewerRole: 'Tech Lead',
    meetingUrl: 'https://meet.example.com/abc-123',
    status: InterviewStatus.SCHEDULED,
    feedback: null,
    outcome: InterviewOutcome.PENDING,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

type CreateInterviewPayload = Pick<CreateInterviewDto, keyof CreateInterviewDto>;

const validCreate = (
  overrides: Partial<CreateInterviewPayload> = {},
): CreateInterviewPayload => ({
  round: 1,
  type: InterviewType.TECHNICAL,
  scheduledAt: SCHEDULED_AT,
  durationMinutes: 60,
  ...overrides,
});

const duplicateError = (): QueryFailedError =>
  new QueryFailedError(
    'INSERT INTO interviews',
    [],
    Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      sqlMessage:
        "Duplicate entry 'x' for key 'interviews.UQ_interviews_application_round'",
    }),
  );

/** Reproduz o ValidationPipe global (whitelist + conversão implícita). */
async function validationErrors<T extends object>(
  type: new () => T,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(type, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('InterviewsService', () => {
  const applicationsRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Application>) => Promise<Application | null>
    >(),
  };
  const interviewsRepository = {
    findOne: vi.fn<
      (options: FindOneOptions<Interview>) => Promise<Interview | null>
    >(),
    find: vi.fn<
      (options: FindManyOptions<Interview>) => Promise<Interview[]>
    >(),
    existsBy: vi.fn<
      (where: FindOptionsWhere<Interview>) => Promise<boolean>
    >(),
    create: vi.fn<(input: Partial<Interview>) => Interview>(),
    save: vi.fn<(interview: Interview) => Promise<Interview>>(),
    delete: vi.fn<(where: FindOptionsWhere<Interview>) => Promise<unknown>>(),
  };

  let service: InterviewsService;

  beforeEach(() => {
    vi.clearAllMocks();

    applicationsRepository.findOne.mockResolvedValue(makeApplication());
    interviewsRepository.findOne.mockResolvedValue(makeInterview());
    interviewsRepository.find.mockResolvedValue([]);
    interviewsRepository.existsBy.mockResolvedValue(false);
    interviewsRepository.create.mockImplementation((input) =>
      // TypeORM preenche @CreateDateColumn/@UpdateDateColumn no `save`; o mock
      // precisa devolver a entidade já persistida para `toResponse()`.
      Object.assign(new Interview(), input, {
        id: INTERVIEW_ID,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    interviewsRepository.save.mockImplementation(async (interview) => interview);
    interviewsRepository.delete.mockResolvedValue({ affected: 1 });

    service = new InterviewsService(
      interviewsRepository as unknown as Repository<Interview>,
      applicationsRepository as unknown as Repository<Application>,
    );
  });

  describe('ownership', () => {
    it('returns 404 and does not write when the application is foreign or missing', async () => {
      applicationsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(USER_ID, OTHER_APPLICATION_ID, validCreate()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(applicationsRepository.findOne).toHaveBeenCalledWith({
        where: { id: OTHER_APPLICATION_ID, userId: USER_ID },
      });
      expect(interviewsRepository.create).not.toHaveBeenCalled();
      expect(interviewsRepository.save).not.toHaveBeenCalled();
    });

    it('returns 404 on listing a foreign application', async () => {
      applicationsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findAll(USER_ID, OTHER_APPLICATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(interviewsRepository.find).not.toHaveBeenCalled();
    });

    it('returns 404 when the interview belongs to another application of the same user', async () => {
      interviewsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(USER_ID, APPLICATION_ID, OTHER_INTERVIEW_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(interviewsRepository.findOne).toHaveBeenCalledWith({
        where: { id: OTHER_INTERVIEW_ID, applicationId: APPLICATION_ID },
      });
    });

    it('returns 404 on update/delete of a foreign interview without touching it', async () => {
      interviewsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(USER_ID, APPLICATION_ID, OTHER_INTERVIEW_ID, {
          status: InterviewStatus.COMPLETED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.remove(USER_ID, APPLICATION_ID, OTHER_INTERVIEW_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(interviewsRepository.save).not.toHaveBeenCalled();
      expect(interviewsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('applies defaults and exposes the created interview as ISO 8601 UTC', async () => {
      const result = await service.create(
        USER_ID,
        APPLICATION_ID,
        validCreate(),
      );

      expect(interviewsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: APPLICATION_ID,
          round: 1,
          type: InterviewType.TECHNICAL,
          scheduledAt: new Date(SCHEDULED_AT),
          durationMinutes: 60,
          interviewerName: null,
          interviewerRole: null,
          meetingUrl: null,
          status: InterviewStatus.SCHEDULED,
          feedback: null,
          outcome: InterviewOutcome.PENDING,
        }),
      );
      expect(result).toEqual<InterviewResponseDto>({
        id: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
        round: 1,
        type: InterviewType.TECHNICAL,
        scheduledAt: SCHEDULED_AT,
        durationMinutes: 60,
        interviewerName: null,
        interviewerRole: null,
        meetingUrl: null,
        status: InterviewStatus.SCHEDULED,
        feedback: null,
        outcome: InterviewOutcome.PENDING,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
      expect(applicationsRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('normalizes an offset to UTC and keeps explicit optional values', async () => {
      await service.create(
        USER_ID,
        APPLICATION_ID,
        validCreate({
          scheduledAt: '2026-11-25T11:00:00-03:00',
          status: InterviewStatus.COMPLETED,
          outcome: InterviewOutcome.PASSED,
          feedback: 'Boa conversa.',
        }),
      );

      expect(interviewsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledAt: new Date('2026-11-25T14:00:00.000Z'),
          status: InterviewStatus.COMPLETED,
          outcome: InterviewOutcome.PASSED,
          feedback: 'Boa conversa.',
        }),
      );
    });

    it('translates ER_DUP_ENTRY of UQ_interviews_application_round to 409', async () => {
      interviewsRepository.save.mockRejectedValueOnce(duplicateError());

      await expect(
        service.create(USER_ID, APPLICATION_ID, validCreate()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not translate unrelated database errors', async () => {
      const failure = new Error('connection lost');
      interviewsRepository.save.mockRejectedValueOnce(failure);

      await expect(
        service.create(USER_ID, APPLICATION_ID, validCreate()),
      ).rejects.toBe(failure);
    });
  });

  describe('findAll', () => {
    it('returns a plain array ordered by round, scheduledAt and id', async () => {
      interviewsRepository.find.mockResolvedValueOnce([
        makeInterview({ round: 1 }),
        makeInterview({ id: OTHER_INTERVIEW_ID, round: 2 }),
      ]);

      const result = await service.findAll(USER_ID, APPLICATION_ID);

      expect(interviewsRepository.find).toHaveBeenCalledWith({
        where: { applicationId: APPLICATION_ID },
        order: { round: 'ASC', scheduledAt: 'ASC', id: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result[1]?.round).toBe(2);
      expect(result[0]).not.toHaveProperty('data');
    });

    it('returns an empty array for an application without interviews', async () => {
      await expect(service.findAll(USER_ID, APPLICATION_ID)).resolves.toEqual([]);
    });
  });

  describe('update', () => {
    it('is a no-op for an empty body: no save and no new updatedAt', async () => {
      const interview = makeInterview();
      interviewsRepository.findOne.mockResolvedValue(interview);

      const result = await service.update(USER_ID, APPLICATION_ID, INTERVIEW_ID, {});

      expect(interviewsRepository.save).not.toHaveBeenCalled();
      expect(result.updatedAt).toBe(NOW.toISOString());
      expect(result.status).toBe(InterviewStatus.SCHEDULED);
    });

    it('changes only the provided fields and lets null clear optional ones', async () => {
      const interview = makeInterview();
      interviewsRepository.findOne.mockResolvedValue(interview);

      const result = await service.update(USER_ID, APPLICATION_ID, INTERVIEW_ID, {
        status: InterviewStatus.COMPLETED,
        outcome: InterviewOutcome.PASSED,
        feedback: 'Boa discussão.',
        meetingUrl: null,
      });

      expect(result.status).toBe(InterviewStatus.COMPLETED);
      expect(result.outcome).toBe(InterviewOutcome.PASSED);
      expect(result.feedback).toBe('Boa discussão.');
      expect(result.meetingUrl).toBeNull();
      expect(result.round).toBe(1);
      expect(result.interviewerName).toBe('Maria Silva');
      expect(interview.meetingUrl).toBeNull();
      expect(interviewsRepository.save).toHaveBeenCalledWith(interview);
    });

    it('returns 409 when the new round is already used by another interview', async () => {
      interviewsRepository.existsBy.mockResolvedValueOnce(true);

      await expect(
        service.update(USER_ID, APPLICATION_ID, INTERVIEW_ID, { round: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(interviewsRepository.existsBy).toHaveBeenCalledWith({
        applicationId: APPLICATION_ID,
        round: 2,
        id: expect.anything(),
      });
      expect(interviewsRepository.save).not.toHaveBeenCalled();
    });

    it('translates a lost race on round uniqueness to 409', async () => {
      interviewsRepository.save.mockRejectedValueOnce(duplicateError());

      await expect(
        service.update(USER_ID, APPLICATION_ID, INTERVIEW_ID, { round: 2 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects null in a required field', async () => {
      await expect(
        service.update(USER_ID, APPLICATION_ID, INTERVIEW_ID, {
          round: null as unknown as number,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(interviewsRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only the interview of the application in the path', async () => {
      await expect(
        service.remove(USER_ID, APPLICATION_ID, INTERVIEW_ID),
      ).resolves.toBeUndefined();

      expect(interviewsRepository.delete).toHaveBeenCalledWith({
        id: INTERVIEW_ID,
        applicationId: APPLICATION_ID,
      });
    });
  });

  describe('CreateInterviewDto validation', () => {
    it.each([0, -1, 1.5, '60', 1441])(
      'rejects invalid durationMinutes %s',
      async (durationMinutes) => {
        const errors = await validationErrors(CreateInterviewDto, {
          ...validCreate(),
          durationMinutes,
        });

        expect(errors.length).toBeGreaterThan(0);
      },
    );

    it.each([1, 1440])('accepts durationMinutes %s', async (durationMinutes) => {
      await expect(
        validationErrors(CreateInterviewDto, {
          ...validCreate(),
          durationMinutes,
        }),
      ).resolves.toEqual([]);
    });

    it.each([
      'javascript:alert(1)',
      'ftp://meet.example.com/abc',
      'not-a-url',
      `https://meet.example.com/${'a'.repeat(250)}`,
    ])('rejects invalid meetingUrl %s', async (meetingUrl) => {
      const errors = await validationErrors(CreateInterviewDto, {
        ...validCreate(),
        meetingUrl,
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts an http/https meeting URL within 255 characters', async () => {
      await expect(
        validationErrors(CreateInterviewDto, {
          ...validCreate(),
          meetingUrl: 'https://meet.example.com/abc-123',
        }),
      ).resolves.toEqual([]);
    });

    it.each(['2026-11-25', '2026-11-25T14:00:00', 'not-a-date'])(
      'rejects scheduledAt without timezone: %s',
      async (scheduledAt) => {
        const errors = await validationErrors(CreateInterviewDto, {
          ...validCreate(),
          scheduledAt,
        });

        expect(errors.length).toBeGreaterThan(0);
      },
    );

    it('accepts an ISO 8601 datetime with a numeric offset', async () => {
      await expect(
        validationErrors(CreateInterviewDto, {
          ...validCreate(),
          scheduledAt: '2026-11-25T11:00:00-03:00',
        }),
      ).resolves.toEqual([]);
    });

    it('rejects a numeric string in round despite implicit conversion', async () => {
      const errors = await validationErrors(CreateInterviewDto, {
        ...validCreate(),
        round: '1',
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects fields outside the whitelist', async () => {
      const errors = await validationErrors(CreateInterviewDto, {
        ...validCreate(),
        userId: USER_ID,
        applicationId: APPLICATION_ID,
        createdAt: NOW.toISOString(),
      });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('allows null only in optional fields on PATCH', async () => {
      await expect(
        validationErrors(UpdateInterviewDto, {
          interviewerName: null,
          interviewerRole: null,
          meetingUrl: null,
          feedback: null,
        }),
      ).resolves.toEqual([]);

      for (const field of [
        'round',
        'type',
        'scheduledAt',
        'durationMinutes',
        'status',
        'outcome',
      ]) {
        await expect(
          validationErrors(UpdateInterviewDto, { [field]: null }),
        ).resolves.not.toEqual([]);
      }
    });

    it('rejects feedback longer than 5000 characters', async () => {
      const errors = await validationErrors(CreateInterviewDto, {
        ...validCreate(),
        feedback: 'a'.repeat(5001),
      });

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
