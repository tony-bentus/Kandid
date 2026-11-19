import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { ApplicationStatus } from '../src/common/enums/application-status.enum.js';
import {
  authorization,
  createTestProfile,
  deleteUsersByEmailPrefix,
  registerTestUser,
  type TestUser,
} from './helpers/auth.js';
import { ensureSkills } from './helpers/ensure-skills.js';
import { errorMentions, expectApiError } from './helpers/response.js';

const EMAIL_PREFIX = 'dashboard-e2e';
const STATUS_ORDER = Object.values(ApplicationStatus);

const SUMMARY_KEYS = [
  'averageDaysPerStage',
  'averageTimeToFirstResponseDays',
  'countsByStatus',
  'interviewRate',
  'offerRate',
  'responseRate',
  'submitted',
  'totalApplications',
] as const;

const COMPENSATION_KEYS = ['byCurrency', 'bySeniority', 'bySkill'] as const;

const COUNTED_TABLES = [
  'applications',
  'application_status_history',
  'interviews',
  'resume_versions',
  'ats_analyses',
] as const;

interface StatsBody {
  count: number;
  minCents: number | null;
  maxCents: number | null;
  averageCents: number | null;
}

interface DifferenceBody {
  absoluteCents: number | null;
  percentage: number | null;
  pairedSampleSize: number;
}

interface BucketBody {
  currency: string;
  salaryPeriod: string;
  applicationCount: number;
  proposed: StatsBody;
  offered: StatsBody;
  difference: DifferenceBody;
  seniority?: string | null;
  skillId?: string;
  skillName?: string;
}

interface StageBody {
  status: string;
  averageDays: number | null;
  sampleSize: number;
}

interface SummaryBody {
  totalApplications: number;
  submitted: number;
  countsByStatus: Record<string, number>;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  averageTimeToFirstResponseDays: number | null;
  averageDaysPerStage: StageBody[];
}

interface CompensationBody {
  byCurrency: BucketBody[];
  bySeniority: BucketBody[];
  bySkill: BucketBody[];
}

interface Fixture {
  applicationId: string;
  jobId: string;
}

interface ApplicationOptions {
  seniority?: string;
  skills?: string[];
  currency?: string;
  salaryPeriod?: string;
  proposed?: number;
  offered?: number;
}

interface HistoryEvent {
  status: string;
  at: string;
}

function stats(
  count: number,
  min: number | null,
  max: number | null,
  average: number | null,
): StatsBody {
  return { count, minCents: min, maxCents: max, averageCents: average };
}

function difference(
  pairedSampleSize: number,
  absoluteCents: number | null,
  percentage: number | null,
): DifferenceBody {
  return { absoluteCents, percentage, pairedSampleSize };
}

describe('KAN-53/54 — Dashboards de funil e compensação (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let user: TestUser;
  let otherUser: TestUser;
  let a1: Fixture;
  let a2: Fixture;
  let a3: Fixture;
  let a4: Fixture;
  let a5: Fixture;
  let a6: Fixture;
  let a7: Fixture;

  let skillAlpha: { id: string; name: string };
  let skillBeta: { id: string; name: string };
  let skillGamma: { id: string; name: string };

  async function newUser(name: string): Promise<TestUser> {
    return registerTestUser(app, EMAIL_PREFIX, name);
  }

  async function createApplicationFixture(
    token: string,
    options: ApplicationOptions = {},
  ): Promise<Fixture> {
    const company = await request(app.getHttpServer())
      .post('/v1/companies')
      .set('Authorization', authorization(token))
      .send({ name: `Empresa ${randomUUID().slice(0, 8)}`, kind: 'CLIENT' })
      .expect(201);

    const jobPayload: Record<string, unknown> = {
      companyId: (company.body as { id: string }).id,
      title: `Vaga ${randomUUID().slice(0, 8)}`,
      description: 'Vaga para fixtures do dashboard.',
      workModel: 'REMOTE',
      contractType: 'CLT',
      source: 'LINKEDIN',
      salaryPeriod: options.salaryPeriod ?? 'MONTH',
      currency: options.currency ?? 'BRL',
    };
    if (options.seniority !== undefined) {
      jobPayload.seniority = options.seniority;
    }
    if (options.skills !== undefined && options.skills.length > 0) {
      jobPayload.skills = options.skills.map((skillId) => ({ skillId }));
    }

    const job = await request(app.getHttpServer())
      .post('/v1/jobs')
      .set('Authorization', authorization(token))
      .send(jobPayload)
      .expect(201);
    const jobId = (job.body as { id: string }).id;

    const applicationPayload: Record<string, unknown> = {};
    if (options.proposed !== undefined) {
      applicationPayload.proposedSalaryCents = options.proposed;
    }
    if (options.offered !== undefined) {
      applicationPayload.offeredSalaryCents = options.offered;
    }
    if (options.currency !== undefined) {
      applicationPayload.currency = options.currency;
    }
    if (options.salaryPeriod !== undefined) {
      applicationPayload.salaryPeriod = options.salaryPeriod;
    }

    const application = await request(app.getHttpServer())
      .post(`/v1/jobs/${jobId}/applications`)
      .set('Authorization', authorization(token))
      .send(applicationPayload)
      .expect(201);

    return { applicationId: (application.body as { id: string }).id, jobId };
  }

  /** Ajusta created_at/applied_at/status e grava histórico com datas controladas. */
  async function setTimeline(
    fixture: Fixture,
    createdAt: string,
    appliedAt: string | null,
    status: string,
    history: HistoryEvent[],
  ): Promise<void> {
    await dataSource.query(
      'UPDATE applications SET created_at = ?, applied_at = ?, status = ? WHERE id = ?',
      [new Date(createdAt), appliedAt, status, fixture.applicationId],
    );

    for (const event of history) {
      await dataSource.query(
        `INSERT INTO application_status_history
          (id, application_id, from_status, to_status, note, changed_at)
         VALUES (?, ?, NULL, ?, NULL, ?)`,
        [randomUUID(), fixture.applicationId, event.status, new Date(event.at)],
      );
    }
  }

  async function getSummary(token: string): Promise<SummaryBody> {
    const response = await request(app.getHttpServer())
      .get('/v1/dashboard/summary')
      .set('Authorization', authorization(token))
      .expect(200);
    return response.body as SummaryBody;
  }

  async function getCompensation(token: string): Promise<CompensationBody> {
    const response = await request(app.getHttpServer())
      .get('/v1/dashboard/compensation')
      .set('Authorization', authorization(token))
      .expect(200);
    return response.body as CompensationBody;
  }

  /**
   * Contagens escopadas aos usuários desta suíte: outras suítes e2e rodam em
   * paralelo e alteram as tabelas globais entre os snapshots.
   */
  async function dumpCounts(): Promise<Record<string, number>> {
    const like = `${EMAIL_PREFIX}-%`;
    const ownedUsers = `(SELECT id FROM users WHERE email LIKE ?)`;
    const ownedApplications = `(SELECT id FROM applications WHERE user_id IN ${ownedUsers})`;
    const ownedJobs = `(SELECT id FROM jobs WHERE user_id IN ${ownedUsers})`;
    const queries: Record<(typeof COUNTED_TABLES)[number], string> = {
      applications: `SELECT COUNT(*) AS total FROM applications WHERE user_id IN ${ownedUsers}`,
      application_status_history: `SELECT COUNT(*) AS total FROM application_status_history WHERE application_id IN ${ownedApplications}`,
      interviews: `SELECT COUNT(*) AS total FROM interviews WHERE application_id IN ${ownedApplications}`,
      resume_versions: `SELECT COUNT(*) AS total FROM resume_versions WHERE job_id IN ${ownedJobs}`,
      ats_analyses: `SELECT COUNT(*) AS total FROM ats_analyses WHERE job_id IN ${ownedJobs}`,
    };

    const result: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      const rows = (await dataSource.query(queries[table], [like])) as Array<{
        total: string | number;
      }>;
      result[table] = Number(rows[0]?.total ?? -1);
    }
    return result;
  }

  /** `applications.job_id` é RESTRICT: filhos primeiro, usuários por último. */
  async function cleanup(): Promise<void> {
    const like = `${EMAIL_PREFIX}-%`;
    const ownedBy = (alias: string) =>
      `${alias} IN (SELECT id FROM users WHERE email LIKE ?)`;

    await dataSource.query(
      `DELETE i FROM interviews i
        JOIN applications a ON a.id = i.application_id
        WHERE ${ownedBy('a.user_id')}`,
      [like],
    );
    await dataSource.query(
      `DELETE h FROM application_status_history h
        JOIN applications a ON a.id = h.application_id
        WHERE ${ownedBy('a.user_id')}`,
      [like],
    );
    await dataSource.query(`DELETE FROM applications WHERE ${ownedBy('user_id')}`, [
      like,
    ]);
    await dataSource.query(`DELETE FROM jobs WHERE ${ownedBy('user_id')}`, [like]);
    await dataSource.query(`DELETE FROM companies WHERE ${ownedBy('user_id')}`, [
      like,
    ]);
    await deleteUsersByEmailPrefix(app, EMAIL_PREFIX);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    await ensureSkills(dataSource);
    const skills = (await dataSource.query(
      'SELECT id, name FROM skills ORDER BY name ASC LIMIT 3',
    )) as Array<{ id: string; name: string }>;
    expect(skills).toHaveLength(3);
    [skillAlpha, skillBeta, skillGamma] = skills as [
      { id: string; name: string },
      { id: string; name: string },
      { id: string; name: string },
    ];

    user = await newUser('Ana Dashboard');
    otherUser = await newUser('Bruno Dashboard');
    await createTestProfile(app, user.token, { headline: 'QA Dashboard' });
    await createTestProfile(app, otherUser.token, { headline: 'QA Isolado' });

    // A1: resposta REJECTED, entrevista SCHEDULED, histórico INTERVIEW, par salarial.
    a1 = await createApplicationFixture(user.token, {
      seniority: 'SENIOR',
      skills: [skillAlpha.id, skillBeta.id],
      proposed: 100000,
      offered: 110000,
    });
    await setTimeline(
      a1,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'REJECTED',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'SCREENING', at: '2026-11-04T00:00:00.000Z' },
        { status: 'INTERVIEW', at: '2026-11-06T00:00:00.000Z' },
        { status: 'OFFER', at: '2026-11-08T00:00:00.000Z' },
        { status: 'REJECTED', at: '2026-11-10T00:00:00.000Z' },
      ],
    );
    await request(app.getHttpServer())
      .post(`/v1/applications/${a1.applicationId}/interviews`)
      .set('Authorization', authorization(user.token))
      .send({
        round: 1,
        type: 'TECHNICAL',
        scheduledAt: '2026-11-06T14:00:00.000Z',
        durationMinutes: 60,
        status: 'SCHEDULED',
      })
      .expect(201);

    // A2: GHOSTED sem resposta; entrevistas CANCELLED/NO_SHOW não contam.
    a2 = await createApplicationFixture(user.token);
    await setTimeline(
      a2,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'GHOSTED',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'GHOSTED', at: '2026-11-05T00:00:00.000Z' },
      ],
    );
    for (const [index, status] of ['CANCELLED', 'NO_SHOW'].entries()) {
      await request(app.getHttpServer())
        .post(`/v1/applications/${a2.applicationId}/interviews`)
        .set('Authorization', authorization(user.token))
        .send({
          round: index + 1,
          type: 'HR',
          scheduledAt: '2026-11-07T14:00:00.000Z',
          durationMinutes: 30,
          status,
        })
        .expect(201);
    }

    // A3: histórico INTERVIEW sem entrevista na tabela; status final WITHDRAWN.
    a3 = await createApplicationFixture(user.token);
    await setTimeline(
      a3,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'WITHDRAWN',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'SCREENING', at: '2026-11-05T00:00:00.000Z' },
        { status: 'INTERVIEW', at: '2026-11-07T00:00:00.000Z' },
        { status: 'WITHDRAWN', at: '2026-11-09T00:00:00.000Z' },
      ],
    );

    // A4: entrevista SCHEDULED sem histórico de INTERVIEW.
    a4 = await createApplicationFixture(user.token);
    await setTimeline(
      a4,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'SCREENING',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'SCREENING', at: '2026-11-03T00:00:00.000Z' },
      ],
    );
    await request(app.getHttpServer())
      .post(`/v1/applications/${a4.applicationId}/interviews`)
      .set('Authorization', authorization(user.token))
      .send({
        round: 1,
        type: 'BEHAVIORAL',
        scheduledAt: '2026-11-04T14:00:00.000Z',
        durationMinutes: 45,
        status: 'SCHEDULED',
      })
      .expect(201);

    // A5: USD/YEAR, senioridade ausente (bucket null), proposto zero → percentage
    // null. A terceira skill faz a soma por skill divergir da soma por moeda.
    a5 = await createApplicationFixture(user.token, {
      currency: 'USD',
      salaryPeriod: 'YEAR',
      proposed: 0,
      offered: 50000,
      skills: [skillGamma.id],
    });
    await setTimeline(
      a5,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'OFFER',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'OFFER', at: '2026-11-04T00:00:00.000Z' },
      ],
    );

    // A6: SAVED sem applied_at, fora do denominador das taxas.
    a6 = await createApplicationFixture(user.token);
    await setTimeline(a6, '2026-10-31T00:00:00.000Z', null, 'SAVED', []);

    // A7: delta negativo na primeira resposta — applied_at (11-20) é posterior
    // ao evento de resposta (11-10), mantendo o histórico cronológico. Proposto
    // sem oferta exercita `offered.count = 0`.
    a7 = await createApplicationFixture(user.token, {
      seniority: 'SENIOR',
      skills: [skillAlpha.id],
      proposed: 200000,
    });
    await setTimeline(
      a7,
      '2026-10-31T00:00:00.000Z',
      '2026-11-20',
      'REJECTED',
      [
        { status: 'APPLIED', at: '2026-11-05T00:00:00.000Z' },
        { status: 'REJECTED', at: '2026-11-10T00:00:00.000Z' },
      ],
    );
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  });

  // -------------------------------------------------------- Autenticação/query

  it.each([
    { label: 'summary', path: '/v1/dashboard/summary' },
    { label: 'compensation', path: '/v1/dashboard/compensation' },
  ])('GET $label sem token responde 401', async ({ path }) => {
    const response = await request(app.getHttpServer()).get(path);

    expectApiError(response, 401, path);
  });

  it.each([
    { label: 'currency', query: 'currency=BRL', term: 'currency' },
    { label: 'from', query: 'from=2026-11-01', term: 'from' },
    { label: 'página', query: 'page=1', term: 'page' },
    { label: 'vazio', query: '?', term: '' },
  ])('GET dashboards com query $label responde 400', async ({ query, term }) => {
    for (const base of ['summary', 'compensation']) {
      const path = `/v1/dashboard/${base}?${query}`;
      const response = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', authorization(user.token))
        .expect(400);

      const body = expectApiError(response, 400, path);
      expect(errorMentions(body, 'Unsupported query parameters')).toBe(true);
      if (term.length > 0) {
        expect(errorMentions(body, term)).toBe(true);
      }
    }
  });

  // -------------------------------------------------------------- Base vazia

  it('usuário sem candidaturas recebe summary zerado no formato canônico', async () => {
    const body = await getSummary(otherUser.token);

    expect(Object.keys(body).sort()).toEqual([...SUMMARY_KEYS].sort());
    expect(body.totalApplications).toBe(0);
    expect(body.submitted).toBe(0);
    expect(body.responseRate).toBeNull();
    expect(body.interviewRate).toBeNull();
    expect(body.offerRate).toBeNull();
    expect(body.averageTimeToFirstResponseDays).toBeNull();

    expect(Object.keys(body.countsByStatus)).toEqual(STATUS_ORDER);
    for (const status of STATUS_ORDER) {
      expect(body.countsByStatus[status]).toBe(0);
    }

    expect(body.averageDaysPerStage).toHaveLength(11);
    expect(body.averageDaysPerStage.map((stage) => stage.status)).toEqual(
      STATUS_ORDER,
    );
    for (const stage of body.averageDaysPerStage) {
      expect(stage).toEqual({ status: stage.status, averageDays: null, sampleSize: 0 });
    }
  });

  it('usuário sem candidaturas recebe compensation com três arrays vazios', async () => {
    const body = await getCompensation(otherUser.token);

    expect(Object.keys(body).sort()).toEqual([...COMPENSATION_KEYS].sort());
    expect(body.byCurrency).toEqual([]);
    expect(body.bySeniority).toEqual([]);
    expect(body.bySkill).toEqual([]);
  });

  // ---------------------------------------------------------------- Summary

  it('summary da fixture tem contagens, submitted e taxas percentuais exatas', async () => {
    const body = await getSummary(user.token);

    expect(body.totalApplications).toBe(7);
    expect(body.submitted).toBe(6);
    expect(Object.keys(body.countsByStatus)).toEqual(STATUS_ORDER);
    expect(body.countsByStatus).toEqual({
      SAVED: 1,
      APPLIED: 0,
      SCREENING: 1,
      SCHEDULED: 0,
      INTERVIEW: 0,
      OFFER: 1,
      HIRED: 0,
      REJECTED: 2,
      WITHDRAWN: 1,
      CANCELLED: 0,
      GHOSTED: 1,
    });
    expect(
      Object.values(body.countsByStatus).reduce((sum, value) => sum + value, 0),
    ).toBe(body.totalApplications);

    // 5 respostas (A1/A3/A4/A5/A7), 4 entrevistas (A1/A3/A4/A5) e 2 ofertas.
    expect(body.responseRate).toBe(83.33);
    expect(body.interviewRate).toBe(66.67);
    expect(body.offerRate).toBe(33.33);
    for (const rate of [body.responseRate, body.interviewRate, body.offerRate]) {
      expect(rate).not.toBeNull();
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
      expect((rate as number) * 100).toBeCloseTo(Math.round((rate as number) * 100), 6);
    }
  });

  it('summary aplica GHOSTED sem resposta, CANCELLED/NO_SHOW e união histórico/entrevista', async () => {
    const body = await getSummary(user.token);

    // A2 (GHOSTED) não respondeu e suas duas entrevistas não contam; A3 conta
    // apenas pelo histórico INTERVIEW; A4 conta apenas pela entrevista SCHEDULED.
    expect(body.responseRate).toBe(83.33);
    expect(body.interviewRate).toBe(66.67);
    expect(body.offerRate).toBe(33.33);
  });

  it('averageTimeToFirstResponseDays ignora delta negativo e SAVED sem appliedAt', async () => {
    const body = await getSummary(user.token);

    // A1=2, A3=3, A4=1, A5=2; A7 negativo e A6 sem applied_at ficam de fora.
    expect(body.averageTimeToFirstResponseDays).toBe(2);
  });

  it('averageDaysPerStage traz 11 itens, âncora SAVED e segmento final aberto excluído', async () => {
    const body = await getSummary(user.token);
    const stages = body.averageDaysPerStage;

    expect(stages.map((stage) => stage.status)).toEqual(STATUS_ORDER);
    const byStatus = new Map(stages.map((stage) => [stage.status, stage]));

    // SAVED: A1..A5 (2 dias cada, até o APPLIED em 11-02) + A7 (5 dias, até
    // o APPLIED em 11-05) = 15/6.
    expect(byStatus.get('SAVED')).toEqual({
      status: 'SAVED',
      averageDays: 2.5,
      sampleSize: 6,
    });
    // APPLIED: A1=2, A2=3, A3=3, A4=1, A5=2, A7=5 (11-05 → 11-10) = 16/6.
    expect(byStatus.get('APPLIED')).toEqual({
      status: 'APPLIED',
      averageDays: 2.67,
      sampleSize: 6,
    });
    // SCREENING e INTERVIEW: A1 e A3, 2 dias cada.
    expect(byStatus.get('SCREENING')?.sampleSize).toBe(2);
    expect(byStatus.get('SCREENING')?.averageDays).toBe(2);
    expect(byStatus.get('INTERVIEW')?.sampleSize).toBe(2);
    expect(byStatus.get('INTERVIEW')?.averageDays).toBe(2);
    // OFFER: apenas A1 (2 dias). Terminais ficam sem amostra (segmento aberto).
    expect(byStatus.get('OFFER')).toEqual({
      status: 'OFFER',
      averageDays: 2,
      sampleSize: 1,
    });
    for (const terminal of ['HIRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'GHOSTED']) {
      expect(byStatus.get(terminal)?.averageDays).toBeNull();
      expect(byStatus.get(terminal)?.sampleSize).toBe(0);
    }
  });

  // ------------------------------------------------------------- Isolamento

  it('candidatura de B não entra no dashboard de A e vice-versa', async () => {
    const summaryABefore = await getSummary(user.token);
    const compensationABefore = await getCompensation(user.token);

    const foreign = await createApplicationFixture(otherUser.token, {
      seniority: 'LEAD',
      proposed: 999999,
      offered: 888888,
      skills: [skillBeta.id],
    });
    await setTimeline(
      foreign,
      '2026-10-31T00:00:00.000Z',
      '2026-11-02',
      'HIRED',
      [
        { status: 'APPLIED', at: '2026-11-02T00:00:00.000Z' },
        { status: 'HIRED', at: '2026-11-03T00:00:00.000Z' },
      ],
    );

    expect(await getSummary(user.token)).toEqual(summaryABefore);
    expect(await getCompensation(user.token)).toEqual(compensationABefore);

    const summaryB = await getSummary(otherUser.token);
    expect(summaryB.totalApplications).toBe(1);
    expect(summaryB.submitted).toBe(1);
    expect(summaryB.countsByStatus.HIRED).toBe(1);
    expect(summaryB.responseRate).toBe(100);
    expect(summaryB.interviewRate).toBe(100);
    expect(summaryB.offerRate).toBe(100);

    const compensationB = await getCompensation(otherUser.token);
    expect(compensationB.byCurrency).toHaveLength(1);
    expect(compensationB.byCurrency[0]?.proposed.minCents).toBe(999999);
    expect(compensationB.byCurrency[0]?.offered.minCents).toBe(888888);
  });

  // ---------------------------------------------------------- Compensation

  it('byCurrency separa BRL/MONTH de USD/YEAR e preserva sinal na amostra pareada', async () => {
    const body = await getCompensation(user.token);

    expect(body.byCurrency).toHaveLength(2);
    const [brl, usd] = body.byCurrency as [BucketBody, BucketBody];

    expect(brl).toEqual({
      currency: 'BRL',
      salaryPeriod: 'MONTH',
      applicationCount: 2,
      proposed: stats(2, 100000, 200000, 150000),
      offered: stats(1, 110000, 110000, 110000),
      difference: difference(1, 10000, 10),
    });

    expect(usd.currency).toBe('USD');
    expect(usd.salaryPeriod).toBe('YEAR');
    expect(usd.applicationCount).toBe(1);
    expect(usd.proposed).toEqual(stats(1, 0, 0, 0));
    expect(usd.offered).toEqual(stats(1, 50000, 50000, 50000));
    // mean(proposed) = 0 → percentage null, mas absoluteCents permanece.
    expect(usd.difference).toEqual(difference(1, 50000, null));
  });

  it('bySeniority é irmão de byCurrency e inclui bucket seniority null', async () => {
    const body = await getCompensation(user.token);

    expect(Object.keys(body).sort()).toEqual([...COMPENSATION_KEYS].sort());
    expect(body.bySeniority).toHaveLength(2);

    const brl = body.bySeniority.find(
      (bucket) => bucket.currency === 'BRL' && bucket.salaryPeriod === 'MONTH',
    );
    expect(brl?.seniority).toBe('SENIOR');
    expect(brl?.applicationCount).toBe(2);
    expect(brl?.proposed).toEqual(stats(2, 100000, 200000, 150000));
    expect(brl?.offered).toEqual(stats(1, 110000, 110000, 110000));
    expect(brl?.difference).toEqual(difference(1, 10000, 10));

    const usd = body.bySeniority.find(
      (bucket) => bucket.currency === 'USD' && bucket.salaryPeriod === 'YEAR',
    );
    expect(usd?.seniority).toBeNull();
    expect(usd?.applicationCount).toBe(1);
    expect(usd?.difference).toEqual(difference(1, 50000, null));
  });

  it('bySkill expande uma candidatura em vários buckets e não reconcilia com byCurrency', async () => {
    const body = await getCompensation(user.token);

    expect(body.bySkill).toHaveLength(3);
    const alpha = body.bySkill.find(
      (bucket) => bucket.skillName === skillAlpha.name,
    );
    const beta = body.bySkill.find((bucket) => bucket.skillName === skillBeta.name);
    const gamma = body.bySkill.find(
      (bucket) => bucket.skillName === skillGamma.name,
    );

    expect(alpha).toBeDefined();
    expect(alpha?.skillId).toBe(skillAlpha.id);
    expect(alpha?.currency).toBe('BRL');
    expect(alpha?.salaryPeriod).toBe('MONTH');
    // A1 e A7 têm alpha; A7 não tem oferta → offered.count = 1 e sem par nela.
    expect(alpha?.applicationCount).toBe(2);
    expect(alpha?.proposed).toEqual(stats(2, 100000, 200000, 150000));
    expect(alpha?.offered).toEqual(stats(1, 110000, 110000, 110000));
    expect(alpha?.difference).toEqual(difference(1, 10000, 10));

    // Apenas A1 tem beta → o bucket nunca herdou a proposta de A7.
    expect(beta).toBeDefined();
    expect(beta?.skillId).toBe(skillBeta.id);
    expect(beta?.applicationCount).toBe(1);
    expect(beta?.proposed).toEqual(stats(1, 100000, 100000, 100000));
    expect(beta?.offered).toEqual(stats(1, 110000, 110000, 110000));
    expect(beta?.difference).toEqual(difference(1, 10000, 10));

    // A5 (USD/YEAR) tem apenas gamma: bucket isolado, sem mistura com BRL.
    expect(gamma).toBeDefined();
    expect(gamma?.skillId).toBe(skillGamma.id);
    expect(gamma?.currency).toBe('USD');
    expect(gamma?.salaryPeriod).toBe('YEAR');
    expect(gamma?.applicationCount).toBe(1);
    expect(gamma?.proposed).toEqual(stats(1, 0, 0, 0));
    expect(gamma?.difference).toEqual(difference(1, 50000, null));

    const sumSkillCounts = body.bySkill.reduce(
      (sum, bucket) => sum + bucket.applicationCount,
      0,
    );
    const sumCurrencyCounts = body.byCurrency.reduce(
      (sum, bucket) => sum + bucket.applicationCount,
      0,
    );
    expect(sumSkillCounts).not.toBe(sumCurrencyCounts);
  });

  it('bucket com proposto médio zero mantém absoluteCents mas zera percentage', async () => {
    const body = await getCompensation(user.token);
    const usd = body.byCurrency.find((bucket) => bucket.currency === 'USD');

    // Há um par em USD, mas com proposto médio zero: percentage é null.
    expect(usd?.difference.pairedSampleSize).toBe(1);
    expect(usd?.difference.percentage).toBeNull();

    // O bucket BRL tem offered.count = 1 < applicationCount = 2: a diferença
    // usa somente o par de A1, não a diferença entre as médias populacionais.
    const brl = body.byCurrency.find((bucket) => bucket.currency === 'BRL');
    expect(brl?.offered.count).toBe(1);
    expect(brl?.difference.absoluteCents).toBe(10000);
    expect(brl?.difference.absoluteCents).not.toBe(
      (brl?.offered.averageCents ?? 0) - (brl?.proposed.averageCents ?? 0),
    );
  });

  // ------------------------------------------------------- Leitura sem escrita

  it('os GETs não escrevem em nenhuma tabela observada', async () => {
    const before = await dumpCounts();

    await getSummary(user.token);
    await getCompensation(user.token);
    await getSummary(otherUser.token);
    await getCompensation(otherUser.token);

    expect(await dumpCounts()).toEqual(before);
    expect(Object.keys(before).sort()).toEqual([...COUNTED_TABLES].sort());
    for (const table of COUNTED_TABLES) {
      expect(before[table]).toBeGreaterThanOrEqual(0);
    }
  });
});
