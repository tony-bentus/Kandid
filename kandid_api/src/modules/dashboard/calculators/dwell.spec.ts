import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import {
  buildDwellSegments,
  emptyStageAverages,
  firstResponseDays,
  summarizeDwell,
} from './dwell.js';
import type { DwellApplication, DwellHistory } from './types.js';

const application = (
  id: string,
  overrides: Partial<DwellApplication> = {},
): DwellApplication => ({
  id,
  status: ApplicationStatus.APPLIED,
  appliedAt: '2026-01-01',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const row = (
  id: string,
  applicationId: string,
  toStatus: ApplicationStatus,
  changedAt: string,
): DwellHistory => ({
  id,
  applicationId,
  toStatus,
  changedAt: new Date(changedAt),
});

describe('firstResponseDays', () => {
  it('usa applied_at às 00:00 UTC com precedência sobre a transição APPLIED', () => {
    const app = application('a', { appliedAt: '2026-01-02' });
    const history = [
      row('1', 'a', ApplicationStatus.APPLIED, '2026-01-04T00:00:00.000Z'),
      row('2', 'a', ApplicationStatus.SCREENING, '2026-01-06T00:00:00.000Z'),
    ];

    expect(firstResponseDays(app, history)).toBe(4);
  });

  it('usa a menor transição → APPLIED como fallback quando applied_at é nulo', () => {
    const app = application('a', { appliedAt: null });
    const history = [
      row('1', 'a', ApplicationStatus.APPLIED, '2026-01-02T00:00:00.000Z'),
      row('2', 'a', ApplicationStatus.APPLIED, '2026-01-01T12:00:00.000Z'),
      row('3', 'a', ApplicationStatus.REJECTED, '2026-01-04T00:00:00.000Z'),
    ];

    expect(firstResponseDays(app, history)).toBe(2.5);
  });

  it('exclui deltas negativos e devolve null sem amostra', () => {
    const app = application('a', { appliedAt: '2026-01-10' });
    const history = [
      row('1', 'a', ApplicationStatus.SCREENING, '2026-01-08T00:00:00.000Z'),
    ];

    expect(firstResponseDays(app, history)).toBeNull();
    expect(
      summarizeDwell([app], history).averageTimeToFirstResponseDays,
    ).toBeNull();
  });
});

describe('buildDwellSegments', () => {
  it('usa a âncora SAVED, ordena por changed_at/id e exclui o último segmento aberto', () => {
    const app = application('a', {
      appliedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const history = [
      row('3', 'a', ApplicationStatus.REJECTED, '2026-01-06T00:00:00.000Z'),
      row('2', 'a', ApplicationStatus.SCREENING, '2026-01-05T12:00:00.000Z'),
      row('1', 'a', ApplicationStatus.APPLIED, '2026-01-03T00:00:00.000Z'),
    ];

    expect(buildDwellSegments(app, history)).toEqual([
      { status: ApplicationStatus.SAVED, days: 2 },
      { status: ApplicationStatus.APPLIED, days: 2.5 },
      { status: ApplicationStatus.SCREENING, days: 0.5 },
    ]);
  });

  it('desempata transições no mesmo microssegundo pelo id', () => {
    const app = application('a');
    const changedAt = '2026-01-03T00:00:00.000Z';
    const history = [
      row('b', 'a', ApplicationStatus.INTERVIEW, changedAt),
      row('a', 'a', ApplicationStatus.SCREENING, changedAt),
    ];

    expect(buildDwellSegments(app, history).map((segment) => segment.status)).toEqual(
      [ApplicationStatus.SAVED, ApplicationStatus.SCREENING],
    );
  });
});

describe('summarizeDwell', () => {
  it('devolve os 11 status com null/sampleSize 0 quando não há segmentos', () => {
    const result = summarizeDwell([], []);

    expect(result.averageTimeToFirstResponseDays).toBeNull();
    expect(result.averageDaysPerStage).toEqual(emptyStageAverages());
    expect(result.averageDaysPerStage).toHaveLength(11);
    expect(result.averageDaysPerStage.map((item) => item.status)).toEqual(
      Object.values(ApplicationStatus),
    );
  });

  it('agrega segmentos fechados por etapa com sampleSize e média em dias', () => {
    const app = application('a', {
      appliedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const history = [
      row('1', 'a', ApplicationStatus.APPLIED, '2026-01-03T00:00:00.000Z'),
      row('2', 'a', ApplicationStatus.SCREENING, '2026-01-05T12:00:00.000Z'),
      row('3', 'a', ApplicationStatus.REJECTED, '2026-01-06T00:00:00.000Z'),
    ];

    const result = summarizeDwell([app], history);
    const byStatus = new Map(
      result.averageDaysPerStage.map((item) => [item.status, item]),
    );

    expect(result.averageTimeToFirstResponseDays).toBe(2.5);
    expect(byStatus.get(ApplicationStatus.SAVED)).toEqual({
      status: ApplicationStatus.SAVED,
      averageDays: 2,
      sampleSize: 1,
    });
    expect(byStatus.get(ApplicationStatus.APPLIED)).toEqual({
      status: ApplicationStatus.APPLIED,
      averageDays: 2.5,
      sampleSize: 1,
    });
    expect(byStatus.get(ApplicationStatus.SCREENING)).toEqual({
      status: ApplicationStatus.SCREENING,
      averageDays: 0.5,
      sampleSize: 1,
    });
    expect(byStatus.get(ApplicationStatus.REJECTED)).toEqual({
      status: ApplicationStatus.REJECTED,
      averageDays: null,
      sampleSize: 0,
    });
  });
});
