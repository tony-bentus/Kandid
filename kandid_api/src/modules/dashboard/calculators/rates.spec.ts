import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import { rate, summarizeFunnel } from './rates.js';
import type {
  FunnelApplication,
  FunnelHistory,
  FunnelInterview,
} from './types.js';

const application = (
  id: string,
  status: ApplicationStatus,
  appliedAt: string | null = '2026-01-01',
): FunnelApplication => ({ id, status, appliedAt });

const history = (
  applicationId: string,
  toStatus: ApplicationStatus,
): FunnelHistory => ({ applicationId, toStatus });

const interview = (
  applicationId: string,
  status: InterviewStatus,
): FunnelInterview => ({ applicationId, status });

describe('summarizeFunnel', () => {
  it('devolve os 11 status com zeros explícitos e taxas null sem base', () => {
    const summary = summarizeFunnel({
      applications: [],
      histories: [],
      interviews: [],
    });

    expect(summary.totalApplications).toBe(0);
    expect(summary.submitted).toBe(0);
    expect(Object.keys(summary.countsByStatus)).toEqual(
      Object.values(ApplicationStatus),
    );
    expect(Object.values(summary.countsByStatus)).toEqual(
      Object.values(ApplicationStatus).map(() => 0),
    );
    expect(summary.responseRate).toBeNull();
    expect(summary.interviewRate).toBeNull();
    expect(summary.offerRate).toBeNull();
    expect(rate(0, 0)).toBeNull();
  });

  it('conta submitted somente por applied_at e mantém a soma dos status igual ao total', () => {
    const applications = [
      application('saved', ApplicationStatus.SAVED, null),
      application('applied', ApplicationStatus.APPLIED),
      application('screened-without-date', ApplicationStatus.SCREENING, null),
    ];

    const summary = summarizeFunnel({
      applications,
      histories: [],
      interviews: [],
    });

    expect(summary.totalApplications).toBe(3);
    expect(summary.submitted).toBe(1);
    expect(
      Object.values(summary.countsByStatus).reduce((sum, value) => sum + value, 0),
    ).toBe(summary.totalApplications);
    expect(summary.responseRate).toBe(0);
  });

  it('calcula 100%, 50% e arredondamento de 2 casas', () => {
    const all = summarizeFunnel({
      applications: [application('a', ApplicationStatus.APPLIED)],
      histories: [history('a', ApplicationStatus.SCREENING)],
      interviews: [],
    });
    const half = summarizeFunnel({
      applications: [
        application('a', ApplicationStatus.APPLIED),
        application('b', ApplicationStatus.APPLIED),
      ],
      histories: [history('a', ApplicationStatus.SCREENING)],
      interviews: [],
    });
    const rounded = summarizeFunnel({
      applications: [
        application('a', ApplicationStatus.APPLIED),
        application('b', ApplicationStatus.APPLIED),
        application('c', ApplicationStatus.APPLIED),
      ],
      histories: [
        history('a', ApplicationStatus.SCREENING),
        history('b', ApplicationStatus.OFFER),
      ],
      interviews: [],
    });

    expect(all.responseRate).toBe(100);
    expect(half.responseRate).toBe(50);
    expect(rounded.responseRate).toBe(66.67);
    expect(rounded.offerRate).toBe(33.33);
    expect(rate(1, 8)).toBe(12.5);
    expect(rate(2, 3)).toBe(66.67);
  });

  it('usa a união entre entrevistas registradas e status atual/histórico', () => {
    const summary = summarizeFunnel({
      applications: [
        application('history-only', ApplicationStatus.WITHDRAWN),
        application('interview-only', ApplicationStatus.APPLIED),
        application('no-show', ApplicationStatus.APPLIED),
        application('saved', ApplicationStatus.SAVED, null),
      ],
      histories: [history('history-only', ApplicationStatus.INTERVIEW)],
      interviews: [
        interview('history-only', InterviewStatus.CANCELLED),
        interview('interview-only', InterviewStatus.SCHEDULED),
        interview('no-show', InterviewStatus.NO_SHOW),
        interview('saved', InterviewStatus.COMPLETED),
      ],
    });

    expect(summary.submitted).toBe(3);
    expect(summary.interviewRate).toBe(66.67);
  });

  it('não conta GHOSTED, WITHDRAWN ou CANCELLED sem resposta anterior', () => {
    const summary = summarizeFunnel({
      applications: [
        application('ghosted', ApplicationStatus.GHOSTED),
        application('withdrawn', ApplicationStatus.WITHDRAWN),
        application('cancelled', ApplicationStatus.CANCELLED),
      ],
      histories: [
        history('withdrawn', ApplicationStatus.OFFER),
        history('cancelled', ApplicationStatus.SCREENING),
      ],
      interviews: [],
    });

    expect(summary.submitted).toBe(3);
    expect(summary.responseRate).toBe(66.67);
    expect(summary.offerRate).toBe(33.33);
  });
});
