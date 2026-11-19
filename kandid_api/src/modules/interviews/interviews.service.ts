import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { InterviewOutcome } from '../../common/enums/interview-outcome.enum.js';
import { InterviewStatus } from '../../common/enums/interview-status.enum.js';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import { assertNoForcedNull, hasField } from '../../common/utils/null-fields.js';
import { Application } from '../applications/entities/application.entity.js';
import { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewResponseDto } from './dto/interview-response.dto.js';
import { UpdateInterviewDto } from './dto/update-interview.dto.js';
import { Interview } from './entities/interview.entity.js';

const DUPLICATE_ROUND_MESSAGE =
  'Interview round already exists for this application';

/** Campos NOT NULL que não aceitam `null` explícito no PATCH. */
const REQUIRED_UPDATE_FIELDS = [
  'round',
  'type',
  'scheduledAt',
  'durationMinutes',
  'status',
  'outcome',
] as const;

/** Todos os campos aceitos no PATCH, usados para detectar body vazio (no-op). */
const UPDATE_FIELDS = [
  ...REQUIRED_UPDATE_FIELDS,
  'interviewerName',
  'interviewerRole',
  'meetingUrl',
  'feedback',
] as const;

/**
 * Entrevistas aninhadas em candidaturas do usuário autenticado (KAN-52).
 *
 * Toda leitura/escrita parte de `applications.id = :id AND user_id = :userId`.
 * O service não toca `applications`, histórico de status nem datas da
 * candidatura; a única tabela escrita é `interviews`.
 */
@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviewsRepository: Repository<Interview>,
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
  ) {}

  /** POST /v1/applications/:id/interviews */
  async create(
    userId: string,
    applicationId: string,
    dto: CreateInterviewDto,
  ): Promise<InterviewResponseDto> {
    await this.requireApplication(userId, applicationId);

    const interview = this.interviewsRepository.create({
      applicationId,
      round: dto.round,
      type: dto.type,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes,
      interviewerName: dto.interviewerName ?? null,
      interviewerRole: dto.interviewerRole ?? null,
      meetingUrl: dto.meetingUrl ?? null,
      status: dto.status ?? InterviewStatus.SCHEDULED,
      feedback: dto.feedback ?? null,
      outcome: dto.outcome ?? InterviewOutcome.PENDING,
    });

    return this.toResponse(await this.save(interview));
  }

  /** GET /v1/applications/:id/interviews — array puro, ordem fixa. */
  async findAll(
    userId: string,
    applicationId: string,
  ): Promise<InterviewResponseDto[]> {
    await this.requireApplication(userId, applicationId);

    const interviews = await this.interviewsRepository.find({
      where: { applicationId },
      order: { round: 'ASC', scheduledAt: 'ASC', id: 'ASC' },
    });

    return interviews.map((interview) => this.toResponse(interview));
  }

  /** GET /v1/applications/:id/interviews/:interviewId */
  async findOne(
    userId: string,
    applicationId: string,
    interviewId: string,
  ): Promise<InterviewResponseDto> {
    await this.requireApplication(userId, applicationId);

    return this.toResponse(
      await this.requireInterview(applicationId, interviewId),
    );
  }

  /** PATCH /v1/applications/:id/interviews/:interviewId — parcial e idempotente. */
  async update(
    userId: string,
    applicationId: string,
    interviewId: string,
    dto: UpdateInterviewDto,
  ): Promise<InterviewResponseDto> {
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    await this.requireApplication(userId, applicationId);
    const interview = await this.requireInterview(applicationId, interviewId);

    if (!UPDATE_FIELDS.some((field) => hasField(dto, field))) {
      return this.toResponse(interview);
    }

    if (hasField(dto, 'round') && dto.round !== undefined) {
      await this.assertRoundAvailable(applicationId, interviewId, dto.round);
      interview.round = dto.round;
    }
    if (hasField(dto, 'type') && dto.type !== undefined) {
      interview.type = dto.type;
    }
    if (hasField(dto, 'scheduledAt') && dto.scheduledAt !== undefined) {
      interview.scheduledAt = new Date(dto.scheduledAt);
    }
    if (hasField(dto, 'durationMinutes') && dto.durationMinutes !== undefined) {
      interview.durationMinutes = dto.durationMinutes;
    }
    if (hasField(dto, 'interviewerName')) {
      interview.interviewerName = dto.interviewerName ?? null;
    }
    if (hasField(dto, 'interviewerRole')) {
      interview.interviewerRole = dto.interviewerRole ?? null;
    }
    if (hasField(dto, 'meetingUrl')) {
      interview.meetingUrl = dto.meetingUrl ?? null;
    }
    if (hasField(dto, 'status') && dto.status !== undefined) {
      interview.status = dto.status;
    }
    if (hasField(dto, 'feedback')) {
      interview.feedback = dto.feedback ?? null;
    }
    if (hasField(dto, 'outcome') && dto.outcome !== undefined) {
      interview.outcome = dto.outcome;
    }

    return this.toResponse(await this.save(interview));
  }

  /** DELETE /v1/applications/:id/interviews/:interviewId — exclusão física. */
  async remove(
    userId: string,
    applicationId: string,
    interviewId: string,
  ): Promise<void> {
    await this.requireApplication(userId, applicationId);
    await this.requireInterview(applicationId, interviewId);

    await this.interviewsRepository.delete({ id: interviewId, applicationId });
  }

  private async requireApplication(
    userId: string,
    applicationId: string,
  ): Promise<Application> {
    const application = await this.applicationsRepository.findOne({
      where: { id: applicationId, userId },
    });

    if (application === null) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  private async requireInterview(
    applicationId: string,
    interviewId: string,
  ): Promise<Interview> {
    const interview = await this.interviewsRepository.findOne({
      where: { id: interviewId, applicationId },
    });

    if (interview === null) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  /** Pré-checagem do PATCH; a UNIQUE cobre a corrida entre requisições. */
  private async assertRoundAvailable(
    applicationId: string,
    interviewId: string,
    round: number,
  ): Promise<void> {
    const taken = await this.interviewsRepository.existsBy({
      applicationId,
      round,
      id: Not(interviewId),
    });

    if (taken) {
      throw new ConflictException(DUPLICATE_ROUND_MESSAGE);
    }
  }

  private async save(interview: Interview): Promise<Interview> {
    try {
      return await this.interviewsRepository.save(interview);
    } catch (error) {
      // Traduz tanto a pré-checagem perdida quanto a corrida de UNIQUE.
      if (isDuplicateEntry(error, 'UQ_interviews_application_round')) {
        throw new ConflictException(DUPLICATE_ROUND_MESSAGE);
      }
      throw error;
    }
  }

  private toResponse(interview: Interview): InterviewResponseDto {
    return {
      id: interview.id,
      applicationId: interview.applicationId,
      round: interview.round,
      type: interview.type,
      scheduledAt: this.requireIso(interview.scheduledAt),
      durationMinutes: interview.durationMinutes,
      interviewerName: interview.interviewerName ?? null,
      interviewerRole: interview.interviewerRole ?? null,
      meetingUrl: interview.meetingUrl ?? null,
      status: interview.status,
      feedback: interview.feedback ?? null,
      outcome: interview.outcome,
      createdAt: this.requireIso(interview.createdAt),
      updatedAt: this.requireIso(interview.updatedAt),
    };
  }

  private requireIso(value: Date | null | undefined): string {
    if (value == null) {
      throw new Error('Expected a persisted datetime');
    }

    return value.toISOString();
  }
}
