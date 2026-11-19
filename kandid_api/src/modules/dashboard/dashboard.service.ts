import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { InterviewStatus } from '../../common/enums/interview-status.enum.js';
import { SalaryPeriod } from '../../common/enums/salary-period.enum.js';
import type { Seniority } from '../../common/enums/seniority.enum.js';
import { bigintCentsToNumber } from '../../common/utils/money.js';
import { Application } from '../applications/entities/application.entity.js';
import { ApplicationStatusHistory } from '../applications/entities/application-status-history.entity.js';
import { Interview } from '../interviews/entities/interview.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { JobSkill } from '../jobs/entities/job-skill.entity.js';
import { Skill } from '../skills/entities/skill.entity.js';
import {
  groupByCurrency,
  groupBySeniority,
  groupBySkill,
} from './calculators/compensation.js';
import { summarizeDwell } from './calculators/dwell.js';
import { summarizeFunnel } from './calculators/rates.js';
import type {
  MoneyInput,
  SeniorityMoneyInput,
  SkillMoneyInput,
} from './calculators/types.js';
import type { DashboardCompensationResponseDto } from './dto/dashboard-compensation-response.dto.js';
import type { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto.js';

interface RawMoneyRow {
  currency: string;
  salaryPeriod: string;
  proposedCents: string | number | null;
  offeredCents: string | number | null;
  seniority: string | null;
}

interface RawSkillMoneyRow extends RawMoneyRow {
  skillId: string;
  skillName: string;
}

/** `bigint` do MySQL chega como string; converte uma vez, antes dos helpers. */
function toCents(
  raw: string | number | null | undefined,
  fieldName: string,
): number | null {
  return raw === null || raw === undefined
    ? null
    : bigintCentsToNumber(String(raw), fieldName);
}

/**
 * Leituras agregadas escopadas por `applications.user_id`. Nenhuma rota deste
 * service escreve, usa relógio de parede ou aceita filtro do cliente.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationsRepository: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepository: Repository<ApplicationStatusHistory>,
    @InjectRepository(Interview)
    private readonly interviewsRepository: Repository<Interview>,
    @InjectRepository(JobSkill)
    private readonly jobSkillsRepository: Repository<JobSkill>,
  ) {}

  async summary(userId: string): Promise<DashboardSummaryResponseDto> {
    const applications = await this.applicationsRepository.find({
      select: {
        id: true,
        status: true,
        appliedAt: true,
        createdAt: true,
      },
      where: { userId },
      order: { id: 'ASC' },
    });

    const histories =
      applications.length === 0
        ? []
        : await this.historyRepository
            .createQueryBuilder('h')
            .select(['h.id', 'h.applicationId', 'h.toStatus', 'h.changedAt'])
            .innerJoin(
              Application,
              'a',
              'a.id = h.applicationId AND a.userId = :userId',
              { userId },
            )
            .orderBy('h.applicationId', 'ASC')
            .addOrderBy('h.changedAt', 'ASC')
            .addOrderBy('h.id', 'ASC')
            .getMany();

    const interviews =
      applications.length === 0
        ? []
        : await this.interviewsRepository
            .createQueryBuilder('i')
            .select(['i.applicationId', 'i.status'])
            .innerJoin(
              Application,
              'a',
              'a.id = i.applicationId AND a.userId = :userId',
              { userId },
            )
            .where('i.status IN (:...statuses)', {
              statuses: [InterviewStatus.SCHEDULED, InterviewStatus.COMPLETED],
            })
            .getMany();

    const funnel = summarizeFunnel({
      applications: applications.map((application) => ({
        id: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
      })),
      histories: histories.map((history) => ({
        applicationId: history.applicationId,
        toStatus: history.toStatus,
      })),
      interviews: interviews.map((interview) => ({
        applicationId: interview.applicationId,
        status: interview.status,
      })),
    });

    const dwell = summarizeDwell(
      applications.map((application) => ({
        id: application.id,
        status: application.status,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
      })),
      histories.map((history) => ({
        id: history.id,
        applicationId: history.applicationId,
        toStatus: history.toStatus,
        changedAt: history.changedAt,
      })),
    );

    return { ...funnel, ...dwell };
  }

  async compensation(userId: string): Promise<DashboardCompensationResponseDto> {
    const moneyRows = await this.applicationsRepository
      .createQueryBuilder('a')
      .select('a.currency', 'currency')
      .addSelect('a.salaryPeriod', 'salaryPeriod')
      .addSelect('a.proposedSalaryCents', 'proposedCents')
      .addSelect('a.offeredSalaryCents', 'offeredCents')
      .addSelect('j.seniority', 'seniority')
      .innerJoin(Job, 'j', 'j.id = a.jobId AND j.userId = :userId', { userId })
      .where('a.userId = :userId', { userId })
      .andWhere(
        '(a.proposedSalaryCents IS NOT NULL OR a.offeredSalaryCents IS NOT NULL)',
      )
      .getRawMany<RawMoneyRow>();

    const skillRows = await this.jobSkillsRepository
      .createQueryBuilder('js')
      .select('a.currency', 'currency')
      .addSelect('a.salaryPeriod', 'salaryPeriod')
      .addSelect('a.proposedSalaryCents', 'proposedCents')
      .addSelect('a.offeredSalaryCents', 'offeredCents')
      .addSelect('s.id', 'skillId')
      .addSelect('s.name', 'skillName')
      .innerJoin(
        Application,
        'a',
        'a.jobId = js.jobId AND a.userId = :userId',
        { userId },
      )
      .innerJoin(Skill, 's', 's.id = js.skillId')
      .where('a.userId = :userId', { userId })
      .andWhere(
        '(a.proposedSalaryCents IS NOT NULL OR a.offeredSalaryCents IS NOT NULL)',
      )
      .getRawMany<RawSkillMoneyRow>();

    const moneyInputs = moneyRows.map((row) => this.toMoneyInput(row));
    const seniorityInputs: SeniorityMoneyInput[] = moneyRows.map((row) => ({
      ...this.toMoneyInput(row),
      seniority: (row.seniority as Seniority | null | undefined) ?? null,
    }));
    const skillInputs: SkillMoneyInput[] = skillRows.map((row) => ({
      ...this.toMoneyInput(row),
      skillId: row.skillId,
      skillName: row.skillName,
    }));

    return {
      byCurrency: groupByCurrency(moneyInputs),
      bySeniority: groupBySeniority(seniorityInputs),
      bySkill: groupBySkill(skillInputs),
    };
  }

  private toMoneyInput(row: RawMoneyRow): MoneyInput {
    return {
      currency: row.currency,
      salaryPeriod: row.salaryPeriod as SalaryPeriod,
      proposedCents: toCents(row.proposedCents, 'proposedSalaryCents'),
      offeredCents: toCents(row.offeredCents, 'offeredSalaryCents'),
    };
  }
}
