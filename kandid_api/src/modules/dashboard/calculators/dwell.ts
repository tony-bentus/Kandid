import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { dateOnlyToUtcMs } from '../../../common/utils/dates.js';
import type { StageAverageResponseDto } from '../dto/stage-average-response.dto.js';
import { RESPONSE_STATUSES } from './rates.js';
import { round2 } from './round.js';
import { compareStrings } from './sort.js';
import type { DwellApplication, DwellHistory } from './types.js';

const MS_PER_DAY = 86_400_000;

const APPLIED_TRANSITION: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.APPLIED,
]);

/** Segmento fechado: status vigente no início e duração em dias (clamp >= 0). */
export interface DwellSegment {
  status: ApplicationStatus;
  days: number;
}

export interface DwellSummary {
  averageTimeToFirstResponseDays: number | null;
  averageDaysPerStage: StageAverageResponseDto[];
}

function compareHistory(left: DwellHistory, right: DwellHistory): number {
  const byDate = left.changedAt.getTime() - right.changedAt.getTime();
  return byDate === 0 ? compareStrings(left.id, right.id) : byDate;
}

function minChangedAtMs(
  history: readonly DwellHistory[],
  statuses: ReadonlySet<ApplicationStatus>,
): number | null {
  let minimum: number | null = null;

  for (const row of history) {
    if (!statuses.has(row.toStatus)) {
      continue;
    }
    const changedAtMs = row.changedAt.getTime();
    if (minimum === null || changedAtMs < minimum) {
      minimum = changedAtMs;
    }
  }

  return minimum;
}

/**
 * Início = `applied_at` às 00:00 UTC, com fallback para a menor transição
 * `→ APPLIED`. Fim = menor transição para um status de resposta. Deltas
 * negativos (dado corrompido) são excluídos.
 */
export function firstResponseDeltaMs(
  application: DwellApplication,
  history: readonly DwellHistory[],
): number | null {
  const startMs =
    application.appliedAt !== null
      ? dateOnlyToUtcMs(application.appliedAt)
      : minChangedAtMs(history, APPLIED_TRANSITION);
  const endMs = minChangedAtMs(history, RESPONSE_STATUSES);

  if (startMs === null || endMs === null) {
    return null;
  }

  const delta = endMs - startMs;
  return delta >= 0 ? delta : null;
}

/** Dias até a primeira resposta, ou `null` quando não há base válida. */
export function firstResponseDays(
  application: DwellApplication,
  history: readonly DwellHistory[],
): number | null {
  const delta = firstResponseDeltaMs(application, history);
  return delta === null ? null : round2(delta / MS_PER_DAY);
}

/**
 * Âncora sintética `(SAVED, created_at)` + histórico ordenado por
 * `(changed_at, id)`. O último segmento fica aberto e é excluído: medir "até
 * agora" dependeria de relógio de parede e quebraria determinismo.
 */
export function buildDwellSegments(
  application: DwellApplication,
  history: readonly DwellHistory[],
): DwellSegment[] {
  const sortedHistory = [...history].sort(compareHistory);
  const events: Array<{ status: ApplicationStatus; atMs: number }> = [
    { status: ApplicationStatus.SAVED, atMs: application.createdAt.getTime() },
    ...sortedHistory.map((row) => ({
      status: row.toStatus,
      atMs: row.changedAt.getTime(),
    })),
  ];
  const segments: DwellSegment[] = [];

  for (let index = 0; index < events.length - 1; index += 1) {
    const current = events[index];
    const next = events[index + 1];
    const days = Math.max((next.atMs - current.atMs) / MS_PER_DAY, 0);
    segments.push({ status: current.status, days });
  }

  return segments;
}

function groupHistoryByApplication(
  histories: readonly DwellHistory[],
): Map<string, DwellHistory[]> {
  const grouped = new Map<string, DwellHistory[]>();

  for (const history of histories) {
    const rows = grouped.get(history.applicationId);
    if (rows === undefined) {
      grouped.set(history.applicationId, [history]);
    } else {
      rows.push(history);
    }
  }

  return grouped;
}

/** Array com os 11 status na ordem do enum, sem amostra. */
export function emptyStageAverages(): StageAverageResponseDto[] {
  return Object.values(ApplicationStatus).map((status) => ({
    status,
    averageDays: null,
    sampleSize: 0,
  }));
}

/** Médias de primeira resposta e de permanência por etapa sobre U. */
export function summarizeDwell(
  applications: readonly DwellApplication[],
  histories: readonly DwellHistory[],
): DwellSummary {
  const historyByApplication = groupHistoryByApplication(histories);
  const sums = new Map<ApplicationStatus, { days: number; sampleSize: number }>();
  let responseMs = 0;
  let responseSampleSize = 0;

  for (const application of applications) {
    const rows = historyByApplication.get(application.id) ?? [];

    const delta = firstResponseDeltaMs(application, rows);
    if (delta !== null) {
      responseMs += delta;
      responseSampleSize += 1;
    }

    for (const segment of buildDwellSegments(application, rows)) {
      const current = sums.get(segment.status) ?? { days: 0, sampleSize: 0 };
      current.days += segment.days;
      current.sampleSize += 1;
      sums.set(segment.status, current);
    }
  }

  return {
    averageTimeToFirstResponseDays:
      responseSampleSize === 0
        ? null
        : round2(responseMs / responseSampleSize / MS_PER_DAY),
    averageDaysPerStage: Object.values(ApplicationStatus).map((status) => {
      const current = sums.get(status);
      if (current === undefined || current.sampleSize === 0) {
        return { status, averageDays: null, sampleSize: 0 };
      }
      return {
        status,
        averageDays: round2(current.days / current.sampleSize),
        sampleSize: current.sampleSize,
      };
    }),
  };
}
