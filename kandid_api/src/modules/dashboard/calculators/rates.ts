import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import {
  InterviewStatus,
} from '../../../common/enums/interview-status.enum.js';
import type { CountsByStatusDto } from '../dto/counts-by-status.dto.js';
import { round2 } from './round.js';
import type {
  FunnelApplication,
  FunnelHistory,
  FunnelInterview,
} from './types.js';

/** Status que representam sinal de resposta da empresa (GHOSTED não é resposta). */
export const RESPONSE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.SCREENING,
  ApplicationStatus.SCHEDULED,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
  ApplicationStatus.REJECTED,
]);

export const INTERVIEW_REACHED_STATUSES: ReadonlySet<ApplicationStatus> =
  new Set([
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.HIRED,
  ]);

export const OFFER_REACHED_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.OFFER,
  ApplicationStatus.HIRED,
]);

const HAPPENED_INTERVIEW_STATUSES: ReadonlySet<InterviewStatus> = new Set([
  InterviewStatus.SCHEDULED,
  InterviewStatus.COMPLETED,
]);

/** Contagens com as 11 chaves na ordem do enum e zero explícito. */
export function countByStatus(
  applications: readonly FunnelApplication[],
): CountsByStatusDto {
  const counts = Object.values(ApplicationStatus).reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<ApplicationStatus, number>,
  );

  for (const application of applications) {
    counts[application.status] += 1;
  }

  return counts;
}

/** Razão percentual 0..100 com 2 casas; `null` quando a base é zero. */
export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round2((numerator * 100) / denominator);
}

export interface FunnelInput {
  applications: readonly FunnelApplication[];
  histories: readonly FunnelHistory[];
  interviews: readonly FunnelInterview[];
}

export interface FunnelSummary {
  totalApplications: number;
  submitted: number;
  countsByStatus: CountsByStatusDto;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
}

function statusSetsByApplication(
  histories: readonly FunnelHistory[],
): Map<string, Set<ApplicationStatus>> {
  const result = new Map<string, Set<ApplicationStatus>>();

  for (const history of histories) {
    let statuses = result.get(history.applicationId);
    if (statuses === undefined) {
      statuses = new Set<ApplicationStatus>();
      result.set(history.applicationId, statuses);
    }
    statuses.add(history.toStatus);
  }

  return result;
}

/**
 * Status atual OU histórico. O status atual cobre dados importados sem linha de
 * histórico; o histórico preserva o fato depois de uma reversão.
 */
function reached(
  application: FunnelApplication,
  statuses: ReadonlySet<ApplicationStatus>,
  historyByApplication: Map<string, Set<ApplicationStatus>>,
): boolean {
  if (statuses.has(application.status)) {
    return true;
  }

  const appHistory = historyByApplication.get(application.id);
  if (appHistory === undefined) {
    return false;
  }

  for (const status of appHistory) {
    if (statuses.has(status)) {
      return true;
    }
  }

  return false;
}

/**
 * Contagens e taxas do funil. Todos os numeradores são interseccionados com
 * `submitted`, então nenhuma taxa passa de 100 mesmo com dado inconsistente.
 */
export function summarizeFunnel(input: FunnelInput): FunnelSummary {
  const { applications, histories, interviews } = input;
  const submittedApplications = applications.filter(
    (application) => application.appliedAt !== null,
  );
  const historyByApplication = statusSetsByApplication(histories);
  const interviewedIds = new Set(
    interviews
      .filter((interview) => HAPPENED_INTERVIEW_STATUSES.has(interview.status))
      .map((interview) => interview.applicationId),
  );

  const responded = submittedApplications.filter((application) =>
    reached(application, RESPONSE_STATUSES, historyByApplication),
  ).length;
  const interviewed = submittedApplications.filter(
    (application) =>
      interviewedIds.has(application.id) ||
      reached(application, INTERVIEW_REACHED_STATUSES, historyByApplication),
  ).length;
  const offered = submittedApplications.filter((application) =>
    reached(application, OFFER_REACHED_STATUSES, historyByApplication),
  ).length;

  const submitted = submittedApplications.length;

  return {
    totalApplications: applications.length,
    submitted,
    countsByStatus: countByStatus(applications),
    responseRate: rate(responded, submitted),
    interviewRate: rate(interviewed, submitted),
    offerRate: rate(offered, submitted),
  };
}
