import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import {
  authorization,
  createTestProfile,
  deleteUsersByEmailPrefix,
  registerTestUser,
  type TestUser,
} from './helpers/auth.js';
import { ensureSkills } from './helpers/ensure-skills.js';
import { errorMentions, expectApiError } from './helpers/response.js';

const EMAIL_PREFIX = 'resumes-e2e';

const NOT_A_UUID = 'not-a-uuid';
const FIXED_UUID = '11111111-1111-4111-8111-111111111111';

const CHECK_IDS = [
  'has-summary',
  'has-contact',
  'has-experience',
  'has-highlights',
  'dates-consistent',
  'no-empty-required-sections',
  'bullet-length',
  'has-skills',
  'target-role-defined',
  'no-duplicate-skills',
] as const;

const DIMENSIONS = [
  'requiredSkills',
  'niceToHaveSkills',
  'seniority',
  'yearsExperience',
  'educationCertification',
  'languages',
  'resumeStructure',
] as const;

const DIMENSION_WEIGHTS = [35, 10, 20, 15, 10, 5, 5] as const;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface ResumeBody {
  id: string;
  userId: string;
  name: string;
  targetRole: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ResumeListBody {
  data: ResumeBody[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SnapshotSkill {
  name: string;
  category: string;
  level: string;
  years: number | null;
}

interface SnapshotExperience {
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  highlights: string[];
}

interface ContentSnapshot {
  schemaVersion: string;
  targetRole: string;
  generatedAt: string;
  candidate: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: { linkedin: string; github: string; portfolio: string };
  };
  summary: string;
  skills: SnapshotSkill[];
  experiences: SnapshotExperience[];
  education: unknown[];
  certifications: unknown[];
  languages: unknown[];
  projects: unknown[];
  seniority?: string;
}

interface ResumeVersionBody {
  id: string;
  resumeId: string;
  version: number;
  jobId: string | null;
  contentSnapshot: ContentSnapshot;
  atsScore: number | null;
  createdAt: string;
}

interface AnalysisDimension {
  dimension: string;
  weight: number;
  effectiveWeight: number;
  earned: number | null;
  applicable: boolean;
  matched: string[];
  missing: string[];
  detail: string | null;
}

interface AnalysisCheck {
  id: string;
  passed: boolean;
  detail: string | null;
}

interface AnalysisBody {
  id: string;
  resumeVersionId: string;
  jobId: string;
  score: number;
  breakdown: AnalysisDimension[];
  checks: AnalysisCheck[];
  matchedKeywords: string[];
  missingKeywords: string[];
  createdAt: string;
}

interface JobBody {
  id: string;
  userId: string;
  companyId: string;
  description: string | null;
  [key: string]: unknown;
}

interface ExperienceBody {
  id: string;
  companyName: string;
  role: string;
  [key: string]: unknown;
}

interface ProfileSkillBody {
  id: string;
  skillId: string;
  level: string;
  [key: string]: unknown;
}

let nameCounter = 0;

function uniqueName(base = 'Currículo'): string {
  nameCounter += 1;

  return `${base} ${nameCounter}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('KAN-40/41/42 — Currículos, versões e ATS (e2e)', () => {
  let app: INestApplication<App>;

  let user: TestUser;
  let otherUser: TestUser;
  let versionUser: TestUser;

  let otherResume: ResumeBody;
  let otherVersion: ResumeVersionBody;
  let otherJob: JobBody;

  let versionExperience: ExperienceBody;
  let nodeSkillId: string;

  async function newUser(): Promise<TestUser> {
    return registerTestUser(app, EMAIL_PREFIX);
  }

  async function createResume(
    token: string,
    body: Record<string, unknown>,
  ): Promise<ResumeBody> {
    const response = await request(app.getHttpServer())
      .post('/v1/resumes')
      .set('Authorization', authorization(token))
      .send(body)
      .expect(201);

    return response.body as ResumeBody;
  }

  async function createVersion(
    token: string,
    resumeId: string,
    body?: Record<string, unknown>,
  ): Promise<ResumeVersionBody> {
    const pending = request(app.getHttpServer())
      .post(`/v1/resumes/${resumeId}/versions`)
      .set('Authorization', authorization(token));

    const response =
      body === undefined
        ? await pending.expect(201)
        : await pending.send(body).expect(201);

    return response.body as ResumeVersionBody;
  }

  async function createJob(
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<JobBody> {
    const companyResponse = await request(app.getHttpServer())
      .post('/v1/companies')
      .set('Authorization', authorization(token))
      .send({ name: `Empresa ${randomUUID().slice(0, 8)}`, kind: 'CLIENT' })
      .expect(201);
    const companyId = (companyResponse.body as { id: string }).id;

    const response = await request(app.getHttpServer())
      .post('/v1/jobs')
      .set('Authorization', authorization(token))
      .send({
        companyId,
        title: 'Desenvolvedor Backend Sênior',
        description: [
          'Requisitos: Node.js, TypeScript e PostgreSQL',
          'Diferenciais: Kubernetes e Docker',
          'Experiência de 5+ anos em backend.',
          'Vaga para profissional Sênior.',
        ].join('\n'),
        seniority: 'SENIOR',
        workModel: 'REMOTE',
        contractType: 'CLT',
        source: 'LINKEDIN',
        salaryPeriod: 'MONTH',
        ...overrides,
      })
      .expect(201);

    return response.body as JobBody;
  }

  async function analyze(
    token: string,
    versionId: string,
    body: Record<string, unknown>,
  ): Promise<AnalysisBody> {
    const response = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${versionId}/analyze`)
      .set('Authorization', authorization(token))
      .send(body)
      .expect(201);

    return response.body as AnalysisBody;
  }

  async function linkSkill(
    token: string,
    skillId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<ProfileSkillBody> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(token))
      .send({ skillId, level: 'ADVANCED', ...overrides })
      .expect(201);

    return response.body as ProfileSkillBody;
  }

  async function findSeededSkillId(term: string): Promise<string> {
    const rows = (await app.get(DataSource).query(
      'SELECT id, name, aliases FROM skills ORDER BY name LIMIT 200',
    )) as Array<{ id: string; name: string; aliases: unknown }>;

    const needle = term.toLowerCase();
    const match = rows.find((row) => {
      const raw = row.aliases;
      const aliases = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? (JSON.parse(raw) as string[])
          : [];

      return [row.name, ...aliases].some(
        (value) =>
          typeof value === 'string' && value.toLowerCase() === needle,
      );
    });

    if (match === undefined) {
      throw new Error(`O seed do catálogo não contém a skill/alias "${term}"`);
    }

    return match.id;
  }

  /**
   * Remove o grafo da sprint na ordem exigida pelas FKs:
   * análises → versões → currículos → vagas → empresas → usuários.
   */
  async function cleanupResumeDomain(): Promise<void> {
    const dataSource = app.get(DataSource);
    const like = `${EMAIL_PREFIX}-%`;

    await dataSource.query(
      `DELETE a FROM ats_analyses a
       JOIN resume_versions v ON v.id = a.resume_version_id
       JOIN resumes r ON r.id = v.resume_id
       JOIN users u ON u.id = r.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

    await dataSource.query(
      `DELETE a FROM ats_analyses a
       JOIN jobs j ON j.id = a.job_id
       JOIN users u ON u.id = j.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

    await dataSource.query(
      `DELETE v FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
       JOIN users u ON u.id = r.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

    await dataSource.query(
      `DELETE r FROM resumes r
       JOIN users u ON u.id = r.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

    await dataSource.query(
      `DELETE j FROM jobs j
       JOIN users u ON u.id = j.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

    await dataSource.query(
      `DELETE c FROM companies c
       JOIN users u ON u.id = c.user_id
       WHERE u.email LIKE ?`,
      [like],
    );

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

    await ensureSkills(app.get(DataSource));

    nodeSkillId = await findSeededSkillId('Node.js');

    user = await newUser();
    await createTestProfile(app, user.token, {
      headline: 'Candidata principal',
      desiredRole: 'Desenvolvedor Backend Sênior',
    });

    otherUser = await newUser();
    await createTestProfile(app, otherUser.token, {
      headline: 'Outro candidato',
      desiredRole: 'Analista de Dados',
      desiredSeniority: 'MID',
    });
    otherResume = await createResume(otherUser.token, {
      name: uniqueName('Currículo alheio'),
      targetRole: 'Analista de Dados',
    });
    otherVersion = await createVersion(otherUser.token, otherResume.id);
    otherJob = await createJob(otherUser.token);

    versionUser = await newUser();
    await createTestProfile(app, versionUser.token, {
      headline: 'Backend Sênior',
      summary: 'Desenvolvedora backend com foco em Node.js e liderança técnica.',
      phone: '+55 11 99999-0000',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
      desiredRole: 'Desenvolvedor Backend Sênior',
      desiredSeniority: 'SENIOR',
    });
    await linkSkill(versionUser.token, nodeSkillId, {
      level: 'ADVANCED',
      yearsExperience: 5,
    });

    const experienceResponse = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(versionUser.token))
      .send({
        companyName: 'Acme',
        role: 'Backend Developer',
        employmentType: 'CLT',
        workModel: 'REMOTE',
        location: 'Remoto',
        startDate: '2023-01-01',
        isCurrent: true,
      })
      .expect(201);
    versionExperience = experienceResponse.body as ExperienceBody;

    await request(app.getHttpServer())
      .post(`/v1/me/experiences/${versionExperience.id}/bullets`)
      .set('Authorization', authorization(versionUser.token))
      .send({ text: 'Reduzi a latência da API em 40%.' })
      .expect(201);
  });

  afterAll(async () => {
    try {
      await cleanupResumeDomain();
    } finally {
      await app.close();
    }
  });

  // ---------------------------------------------------------------- 1. Auth

  it.each([
    {
      label: 'GET /v1/resumes',
      path: '/v1/resumes',
      run: async () => request(app.getHttpServer()).get('/v1/resumes'),
    },
    {
      label: 'POST /v1/resumes',
      path: '/v1/resumes',
      run: async () =>
        request(app.getHttpServer())
          .post('/v1/resumes')
          .send({ name: 'Sem token' }),
    },
    {
      label: 'GET /v1/resumes/:id',
      path: `/v1/resumes/${FIXED_UUID}`,
      run: async () =>
        request(app.getHttpServer()).get(`/v1/resumes/${FIXED_UUID}`),
    },
    {
      label: 'PATCH /v1/resumes/:id',
      path: `/v1/resumes/${FIXED_UUID}`,
      run: async () =>
        request(app.getHttpServer())
          .patch(`/v1/resumes/${FIXED_UUID}`)
          .send({ name: 'Sem token' }),
    },
    {
      label: 'DELETE /v1/resumes/:id',
      path: `/v1/resumes/${FIXED_UUID}`,
      run: async () =>
        request(app.getHttpServer()).delete(`/v1/resumes/${FIXED_UUID}`),
    },
    {
      label: 'POST /v1/resumes/:id/versions',
      path: `/v1/resumes/${FIXED_UUID}/versions`,
      run: async () =>
        request(app.getHttpServer()).post(
          `/v1/resumes/${FIXED_UUID}/versions`,
        ),
    },
    {
      label: 'GET /v1/resume-versions/:id',
      path: `/v1/resume-versions/${FIXED_UUID}`,
      run: async () =>
        request(app.getHttpServer()).get(`/v1/resume-versions/${FIXED_UUID}`),
    },
    {
      label: 'POST /v1/resume-versions/:id/analyze',
      path: `/v1/resume-versions/${FIXED_UUID}/analyze`,
      run: async () =>
        request(app.getHttpServer())
          .post(`/v1/resume-versions/${FIXED_UUID}/analyze`)
          .send({ jobId: FIXED_UUID }),
    },
    {
      label: 'GET /v1/resume-versions/:id/analysis',
      path: `/v1/resume-versions/${FIXED_UUID}/analysis`,
      run: async () =>
        request(app.getHttpServer()).get(
          `/v1/resume-versions/${FIXED_UUID}/analysis`,
        ),
    },
  ])('$label sem token responde 401', async ({ path, run }) => {
    const raw = await run();

    expectApiError({ status: raw.status, body: raw.body }, 401, path);
  });

  // ----------------------------------------------------- 2. POST /v1/resumes

  it('POST /v1/resumes cria com os campos do contrato e marca o primeiro como default', async () => {
    const owner = await newUser();
    const name = uniqueName('Currículo principal');

    const created = await createResume(owner.token, {
      name,
      targetRole: 'Desenvolvedor Backend Sênior',
    });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(owner.userId);
    expect(created.name).toBe(name);
    expect(created.targetRole).toBe('Desenvolvedor Backend Sênior');
    expect(created.isDefault).toBe(true);
    expect(created.createdAt).toMatch(ISO_UTC);
    expect(created.updatedAt).toMatch(ISO_UTC);
    expect(created).not.toHaveProperty('versions');
    expect(created).not.toHaveProperty('atsScore');

    const second = await createResume(owner.token, {
      name: uniqueName('Currículo secundário'),
    });

    expect(second.isDefault).toBe(false);

    const list = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const body = list.body as ResumeListBody;

    expect(body.data.find((item) => item.id === created.id)?.isDefault).toBe(
      true,
    );
    expect(body.data.find((item) => item.id === second.id)?.isDefault).toBe(
      false,
    );
  });

  it('POST /v1/resumes ignora isDefault: false no primeiro currículo', async () => {
    const owner = await newUser();

    const created = await createResume(owner.token, {
      name: uniqueName('Currículo único'),
      isDefault: false,
    });

    expect(created.isDefault).toBe(true);
  });

  it('POST /v1/resumes com nome duplicado do mesmo usuário responde 409', async () => {
    const owner = await newUser();
    const name = uniqueName('Duplicado');

    await createResume(owner.token, { name });

    const response = await request(app.getHttpServer())
      .post('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .send({ name })
      .expect(409);

    const body = expectApiError(response, 409, '/v1/resumes');
    expect(body.message).toBeTruthy();

    const list = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);

    expect((list.body as ResumeListBody).data).toHaveLength(1);
  });

  it('POST /v1/resumes herda targetRole do desiredRole do perfil', async () => {
    const owner = await newUser();
    await createTestProfile(app, owner.token, {
      headline: 'Perfil com cargo',
      desiredRole: 'Tech Lead',
    });

    const created = await createResume(owner.token, {
      name: uniqueName('Herda cargo'),
    });

    expect(created.targetRole).toBe('Tech Lead');
  });

  it('POST /v1/resumes usa targetRole vazio quando o usuário não tem perfil', async () => {
    const owner = await newUser();

    const created = await createResume(owner.token, {
      name: uniqueName('Sem perfil'),
    });

    expect(created.targetRole).toBe('');
  });

  it.each(['userId', 'id', 'versions', 'atsScore'])(
    'POST /v1/resumes rejeita campo fora da whitelist (%s) com 400',
    async (field) => {
      const owner = await newUser();

      const response = await request(app.getHttpServer())
        .post('/v1/resumes')
        .set('Authorization', authorization(owner.token))
        .send({ name: uniqueName('Inválido'), [field]: 'hack' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/resumes');
      expect(errorMentions(body, field)).toBe(true);
    },
  );

  it.each([
    { label: 'vazio', body: { name: '' } },
    { label: 'ausente', body: {} },
  ])('POST /v1/resumes rejeita name $label com 400', async ({ body }) => {
    const owner = await newUser();

    const response = await request(app.getHttpServer())
      .post('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .send(body)
      .expect(400);

    expectApiError(response, 400, '/v1/resumes');
  });

  it('dois usuários podem criar currículos com o mesmo nome', async () => {
    const first = await newUser();
    const second = await newUser();
    const name = uniqueName('Nome compartilhado');

    const firstResume = await createResume(first.token, { name });
    const secondResume = await createResume(second.token, { name });

    expect(firstResume.name).toBe(name);
    expect(secondResume.name).toBe(name);
    expect(firstResume.id).not.toBe(secondResume.id);
  });

  // ------------------------------------------------------ 3. GET /v1/resumes

  it('GET /v1/resumes devolve envelope { data, meta } com paginação default', async () => {
    const owner = await newUser();
    const created = [
      await createResume(owner.token, { name: uniqueName('Lista') }),
      await createResume(owner.token, { name: uniqueName('Lista') }),
      await createResume(owner.token, { name: uniqueName('Lista') }),
    ];

    const response = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const body = response.body as ResumeListBody;

    expect(body.data).toHaveLength(3);
    expect(body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
    expect(body.data.map((item) => item.id).sort()).toEqual(
      created.map((item) => item.id).sort(),
    );
  });

  it('GET /v1/resumes ordena por createdAt DESC e id ASC', async () => {
    const owner = await newUser();
    const created = [
      await createResume(owner.token, { name: uniqueName('Ordem') }),
      await createResume(owner.token, { name: uniqueName('Ordem') }),
      await createResume(owner.token, { name: uniqueName('Ordem') }),
    ];

    const response = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const items = (response.body as ResumeListBody).data;

    expect(items).toHaveLength(created.length);

    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];

      if (previous === undefined || current === undefined) {
        continue;
      }

      expect(previous.createdAt >= current.createdAt).toBe(true);

      if (previous.createdAt === current.createdAt) {
        expect(previous.id < current.id).toBe(true);
      }
    }
  });

  it('GET /v1/resumes respeita page e limit sem repetir itens', async () => {
    const owner = await newUser();
    const created = [
      await createResume(owner.token, { name: uniqueName('Página') }),
      await createResume(owner.token, { name: uniqueName('Página') }),
      await createResume(owner.token, { name: uniqueName('Página') }),
    ];

    const firstPage = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ page: 1, limit: 2 })
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const secondPage = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ page: 2, limit: 2 })
      .set('Authorization', authorization(owner.token))
      .expect(200);

    const firstBody = firstPage.body as ResumeListBody;
    const secondBody = secondPage.body as ResumeListBody;

    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.meta.page).toBe(2);

    const firstIds = firstBody.data.map((item) => item.id);
    const secondIds = secondBody.data.map((item) => item.id);

    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
    expect([...firstIds, ...secondIds].sort()).toEqual(
      created.map((item) => item.id).sort(),
    );
  });

  it('GET /v1/resumes com page além do fim responde 200 com data vazio e meta estável', async () => {
    const owner = await newUser();
    await createResume(owner.token, { name: uniqueName('Além do fim') });
    await createResume(owner.token, { name: uniqueName('Além do fim') });

    const firstPage = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ page: 1, limit: 10 })
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const firstBody = firstPage.body as ResumeListBody;
    const beyondPage = firstBody.meta.totalPages + 1;

    const response = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ page: beyondPage, limit: 10 })
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const body = response.body as ResumeListBody;

    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({
      page: beyondPage,
      limit: 10,
      total: firstBody.meta.total,
      totalPages: firstBody.meta.totalPages,
    });
  });

  it('GET /v1/resumes com limit acima de 100 responde 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ limit: 101 })
      .set('Authorization', authorization(user.token))
      .expect(400);

    const body = expectApiError(response, 400, '/v1/resumes?limit=101');
    expect(errorMentions(body, 'limit')).toBe(true);
  });

  it('GET /v1/resumes com sort responde 400 explicando o parâmetro não suportado', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/resumes')
      .query({ sort: 'createdAt' })
      .set('Authorization', authorization(user.token))
      .expect(400);

    const body = expectApiError(response, 400, '/v1/resumes?sort=createdAt');

    expect(errorMentions(body, 'sort')).toBe(true);
    expect(JSON.stringify(body.message)).toContain('Unsupported');
  });

  it('GET /v1/resumes lista somente os currículos do usuário autenticado', async () => {
    const owner = await newUser();
    const own = await createResume(owner.token, {
      name: uniqueName('Só meu'),
    });

    const list = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(otherUser.token))
      .expect(200);
    const ids = (list.body as ResumeListBody).data.map((item) => item.id);

    expect(ids).not.toContain(own.id);
    expect(ids).toContain(otherResume.id);
  });

  // ------------------------------------------ 4. GET/PATCH/DELETE /resumes/:id

  it.each([
    {
      label: 'GET',
      path: `/v1/resumes/${NOT_A_UUID}`,
      run: async () =>
        request(app.getHttpServer())
          .get(`/v1/resumes/${NOT_A_UUID}`)
          .set('Authorization', authorization(user.token)),
    },
    {
      label: 'PATCH',
      path: `/v1/resumes/${NOT_A_UUID}`,
      run: async () =>
        request(app.getHttpServer())
          .patch(`/v1/resumes/${NOT_A_UUID}`)
          .set('Authorization', authorization(user.token))
          .send({ name: 'X' }),
    },
    {
      label: 'DELETE',
      path: `/v1/resumes/${NOT_A_UUID}`,
      run: async () =>
        request(app.getHttpServer())
          .delete(`/v1/resumes/${NOT_A_UUID}`)
          .set('Authorization', authorization(user.token)),
    },
  ])('$label /v1/resumes/:id com id não-UUID responde 400', async ({ path, run }) => {
    const raw = await run();

    expectApiError({ status: raw.status, body: raw.body }, 400, path);
  });

  it('GET/PATCH/DELETE de currículo de outro usuário respondem 404', async () => {
    const id = otherResume.id;

    const get = await request(app.getHttpServer())
      .get(`/v1/resumes/${id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);
    expectApiError(get, 404, `/v1/resumes/${id}`);

    const patch = await request(app.getHttpServer())
      .patch(`/v1/resumes/${id}`)
      .set('Authorization', authorization(user.token))
      .send({ name: 'Invasor' })
      .expect(404);
    expectApiError(patch, 404, `/v1/resumes/${id}`);

    const del = await request(app.getHttpServer())
      .delete(`/v1/resumes/${id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);
    expectApiError(del, 404, `/v1/resumes/${id}`);
  });

  it.each(['name', 'targetRole', 'isDefault'])(
    'PATCH /v1/resumes/:id rejeita %s null com 400',
    async (field) => {
      const owner = await newUser();
      const resume = await createResume(owner.token, {
        name: uniqueName('Null'),
      });

      const response = await request(app.getHttpServer())
        .patch(`/v1/resumes/${resume.id}`)
        .set('Authorization', authorization(owner.token))
        .send({ [field]: null })
        .expect(400);

      const body = expectApiError(response, 400, `/v1/resumes/${resume.id}`);
      expect(errorMentions(body, field)).toBe(true);

      const reread = await request(app.getHttpServer())
        .get(`/v1/resumes/${resume.id}`)
        .set('Authorization', authorization(owner.token))
        .expect(200);

      expect((reread.body as ResumeBody).name).toBe(resume.name);
    },
  );

  it('PATCH /v1/resumes/:id aceita targetRole vazio', async () => {
    const owner = await newUser();
    const resume = await createResume(owner.token, {
      name: uniqueName('Cargo'),
      targetRole: 'Backend',
    });

    const response = await request(app.getHttpServer())
      .patch(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(owner.token))
      .send({ targetRole: '' })
      .expect(200);

    expect((response.body as ResumeBody).targetRole).toBe('');
  });

  it('PATCH /v1/resumes/:id renomeando para nome já usado responde 409 e preserva o nome antigo', async () => {
    const owner = await newUser();
    const nameA = uniqueName('Nome A');
    const nameB = uniqueName('Nome B');
    const resumeA = await createResume(owner.token, { name: nameA });
    const resumeB = await createResume(owner.token, { name: nameB });

    const response = await request(app.getHttpServer())
      .patch(`/v1/resumes/${resumeB.id}`)
      .set('Authorization', authorization(owner.token))
      .send({ name: nameA })
      .expect(409);

    const body = expectApiError(response, 409, `/v1/resumes/${resumeB.id}`);

    expect(body.message).toBe('Resume name already exists for this user');

    const reread = await request(app.getHttpServer())
      .get(`/v1/resumes/${resumeB.id}`)
      .set('Authorization', authorization(owner.token))
      .expect(200);

    expect((reread.body as ResumeBody).name).toBe(nameB);

    const rereadA = await request(app.getHttpServer())
      .get(`/v1/resumes/${resumeA.id}`)
      .set('Authorization', authorization(owner.token))
      .expect(200);

    expect((rereadA.body as ResumeBody).name).toBe(nameA);
  });

  it('PATCH isDefault: true desmarca o currículo default anterior', async () => {
    const owner = await newUser();
    const first = await createResume(owner.token, {
      name: uniqueName('Default 1'),
    });
    const second = await createResume(owner.token, {
      name: uniqueName('Default 2'),
    });

    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);

    const patched = await request(app.getHttpServer())
      .patch(`/v1/resumes/${second.id}`)
      .set('Authorization', authorization(owner.token))
      .send({ isDefault: true })
      .expect(200);

    expect((patched.body as ResumeBody).isDefault).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);
    const items = (list.body as ResumeListBody).data;

    expect(items.find((item) => item.id === first.id)?.isDefault).toBe(false);
    expect(items.find((item) => item.id === second.id)?.isDefault).toBe(true);
    expect(items.filter((item) => item.isDefault)).toHaveLength(1);
  });

  it('PATCH isDefault: false deixa o usuário sem currículo default', async () => {
    const owner = await newUser();
    const first = await createResume(owner.token, {
      name: uniqueName('Sem default'),
    });
    await createResume(owner.token, { name: uniqueName('Sem default') });

    const patched = await request(app.getHttpServer())
      .patch(`/v1/resumes/${first.id}`)
      .set('Authorization', authorization(owner.token))
      .send({ isDefault: false })
      .expect(200);

    expect((patched.body as ResumeBody).isDefault).toBe(false);

    const list = await request(app.getHttpServer())
      .get('/v1/resumes')
      .set('Authorization', authorization(owner.token))
      .expect(200);

    expect(
      (list.body as ResumeListBody).data.every((item) => !item.isDefault),
    ).toBe(true);
  });

  it('DELETE /v1/resumes/:id sem versões responde 204 e remove o currículo', async () => {
    const owner = await newUser();
    const resume = await createResume(owner.token, {
      name: uniqueName('Descartável'),
    });

    const response = await request(app.getHttpServer())
      .delete(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(owner.token))
      .expect(204);

    expect(response.text).toBe('');

    await request(app.getHttpServer())
      .get(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(owner.token))
      .expect(404);
  });

  it('DELETE /v1/resumes/:id com versão responde 409 e preserva o currículo', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Com versão'),
    });
    await createVersion(versionUser.token, resume.id);

    const response = await request(app.getHttpServer())
      .delete(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(409);

    expectApiError(response, 409, `/v1/resumes/${resume.id}`);

    await request(app.getHttpServer())
      .get(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);
  });

  // ------------------------------------------- 5. POST /v1/resumes/:id/versions

  it('POST /v1/resumes/:id/versions sem body gera a versão 1 com o snapshot do perfil', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Snapshot'),
      targetRole: 'Desenvolvedor Backend Sênior',
    });

    const version = await createVersion(versionUser.token, resume.id);
    const snapshot = version.contentSnapshot;

    expect(version.id).toBeDefined();
    expect(version.resumeId).toBe(resume.id);
    expect(version.version).toBe(1);
    expect(version.jobId).toBeNull();
    expect(version.atsScore).toBeNull();
    expect(version.createdAt).toMatch(ISO_UTC);

    expect(snapshot.schemaVersion).toBe('1.0');
    expect(snapshot.targetRole).toBe('Desenvolvedor Backend Sênior');
    expect(snapshot.generatedAt).toMatch(ISO_UTC);
    expect(snapshot.seniority).toBe('SENIOR');
    expect(snapshot.candidate.email).toBe(versionUser.email);
    expect(snapshot.candidate.phone).toBe('+55 11 99999-0000');

    expect(snapshot.skills.some((skill) => skill.name === 'Node.js')).toBe(true);
    expect(snapshot.experiences).toHaveLength(1);
    expect(snapshot.experiences[0]).toMatchObject({
      company: 'Acme',
      role: 'Backend Developer',
      startDate: '2023-01',
      endDate: null,
      current: true,
    });
    expect(snapshot.experiences[0]?.highlights).toContain(
      'Reduzi a latência da API em 40%.',
    );
  });

  it('POST /v1/resumes/:id/versions incrementa a versão na segunda geração', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Duas versões'),
    });

    const first = await createVersion(versionUser.token, resume.id);
    const second = await createVersion(versionUser.token, resume.id);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.id).not.toBe(first.id);
    expect(second.resumeId).toBe(resume.id);
  });

  it('POST /v1/resumes/:id/versions associa jobId de vaga própria', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Com vaga'),
    });
    const job = await createJob(versionUser.token);

    const version = await createVersion(versionUser.token, resume.id, {
      jobId: job.id,
    });

    expect(version.jobId).toBe(job.id);
    expect(version.atsScore).toBeNull();
  });

  it('POST /v1/resumes/:id/versions com jobId de vaga alheia responde 404', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga alheia'),
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${resume.id}/versions`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: otherJob.id })
      .expect(404);

    expectApiError(response, 404, `/v1/resumes/${resume.id}/versions`);
  });

  it('POST /v1/resumes/:id/versions com jobId inexistente responde 404', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga inexistente'),
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${resume.id}/versions`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: randomUUID() })
      .expect(404);

    expectApiError(response, 404, `/v1/resumes/${resume.id}/versions`);
  });

  it('POST /v1/resumes/:id/versions com jobId não-UUID responde 400', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga inválida'),
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${resume.id}/versions`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: NOT_A_UUID })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/resumes/${resume.id}/versions`,
    );
    expect(errorMentions(body, 'jobId')).toBe(true);
  });

  it('POST /v1/resumes/:id/versions em currículo de outro usuário responde 404', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${otherResume.id}/versions`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);

    expectApiError(response, 404, `/v1/resumes/${otherResume.id}/versions`);
  });

  it('POST /v1/resumes/:id/versions sem perfil responde 400 com a mensagem do domínio', async () => {
    const owner = await newUser();
    const resume = await createResume(owner.token, {
      name: uniqueName('Sem perfil'),
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${resume.id}/versions`)
      .set('Authorization', authorization(owner.token))
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/resumes/${resume.id}/versions`,
    );

    expect(body.message).toBe(
      'Profile is required to generate a resume version',
    );

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM resume_versions WHERE resume_id = ?',
      [resume.id],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(0);
  });

  // -------------------------------------------- 6. GET /v1/resume-versions/:id

  it('GET /v1/resume-versions/:id devolve o snapshot com atsScore null', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Leitura'),
    });
    const created = await createVersion(versionUser.token, resume.id);

    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${created.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    const body = response.body as ResumeVersionBody;

    expect(body.id).toBe(created.id);
    expect(body.resumeId).toBe(resume.id);
    expect(body.version).toBe(created.version);
    expect(body.atsScore).toBeNull();
    expect(body.contentSnapshot.schemaVersion).toBe('1.0');
    expect(body.contentSnapshot.generatedAt).toMatch(ISO_UTC);
    expect(body.createdAt).toMatch(ISO_UTC);
  });

  it('GET /v1/resume-versions/:id de versão alheia ou inexistente responde 404', async () => {
    const other = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${otherVersion.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);
    expectApiError(other, 404, `/v1/resume-versions/${otherVersion.id}`);

    const missingId = randomUUID();
    const missing = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${missingId}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);
    expectApiError(missing, 404, `/v1/resume-versions/${missingId}`);
  });

  it('GET /v1/resume-versions/:id com id não-UUID responde 400', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${NOT_A_UUID}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(400);

    expectApiError(response, 400, `/v1/resume-versions/${NOT_A_UUID}`);
  });

  // ------------------------------------- 7. POST /v1/resume-versions/:id/analyze

  it('POST /v1/resume-versions/:id/analyze devolve score, 7 dimensões, 10 checks e keywords', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Análise'),
    });
    const version = await createVersion(versionUser.token, resume.id);
    const job = await createJob(versionUser.token);

    const analysis = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });

    expect(analysis.id).toBeDefined();
    expect(analysis.resumeVersionId).toBe(version.id);
    expect(analysis.jobId).toBe(job.id);
    expect(Number.isInteger(analysis.score)).toBe(true);
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);

    expect(analysis.breakdown.map((item) => item.dimension)).toEqual([
      ...DIMENSIONS,
    ]);
    expect(analysis.breakdown.map((item) => item.weight)).toEqual([
      ...DIMENSION_WEIGHTS,
    ]);

    for (const item of analysis.breakdown) {
      expect(typeof item.effectiveWeight).toBe('number');
      expect(typeof item.applicable).toBe('boolean');
      expect(Array.isArray(item.matched)).toBe(true);
      expect(Array.isArray(item.missing)).toBe(true);
      if (item.earned !== null) {
        expect(Number.isInteger(item.earned)).toBe(true);
        expect(item.earned).toBeGreaterThanOrEqual(0);
        expect(item.earned).toBeLessThanOrEqual(100);
      }
    }

    expect(analysis.checks.map((check) => check.id)).toEqual([...CHECK_IDS]);
    expect(analysis.checks.every((check) => typeof check.passed === 'boolean')).toBe(
      true,
    );
    expect(Array.isArray(analysis.matchedKeywords)).toBe(true);
    expect(Array.isArray(analysis.missingKeywords)).toBe(true);
    expect(analysis.createdAt).toMatch(ISO_UTC);
  });

  it('GET /v1/resume-versions/:id continua com atsScore null após a análise', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Score imutável'),
    });
    const version = await createVersion(versionUser.token, resume.id);
    const job = await createJob(versionUser.token);

    await analyze(versionUser.token, version.id, { jobId: job.id });

    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    expect((response.body as ResumeVersionBody).atsScore).toBeNull();

    const rows = (await app.get(DataSource).query(
      'SELECT ats_score FROM resume_versions WHERE id = ?',
      [version.id],
    )) as Array<{ ats_score: number | null }>;

    expect(rows[0]?.ats_score).toBeNull();
  });

  it('reanalisar cria uma nova linha e GET analysis devolve a mais recente', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Reanálise'),
    });
    const version = await createVersion(versionUser.token, resume.id);
    const job = await createJob(versionUser.token);

    const first = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });
    await sleep(10);
    const second = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });

    expect(second.id).not.toBe(first.id);

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM ats_analyses WHERE resume_version_id = ?',
      [version.id],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(2);

    const latest = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}/analysis`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    const body = latest.body as AnalysisBody;

    expect(body.id).toBe(second.id);
    expect(body.score).toBe(second.score);

    const versionAfter = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    expect((versionAfter.body as ResumeVersionBody).atsScore).toBeNull();
  });

  it('POST analyze com jobId divergente da vaga da versão responde 400', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Divergente'),
    });
    const versionJob = await createJob(versionUser.token);
    const otherJobOfUser = await createJob(versionUser.token);
    const version = await createVersion(versionUser.token, resume.id, {
      jobId: versionJob.id,
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${version.id}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: otherJobOfUser.id })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/resume-versions/${version.id}/analyze`,
    );
    expect(errorMentions(body, 'jobId')).toBe(true);
  });

  it('POST analyze com vaga alheia ou inexistente responde 404', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga da análise'),
    });
    const version = await createVersion(versionUser.token, resume.id);

    const foreign = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${version.id}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: otherJob.id })
      .expect(404);
    expectApiError(foreign, 404, `/v1/resume-versions/${version.id}/analyze`);

    const missingId = randomUUID();
    const missing = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${version.id}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: missingId })
      .expect(404);
    expectApiError(missing, 404, `/v1/resume-versions/${version.id}/analyze`);
  });

  it('POST analyze em versão alheia ou inexistente responde 404', async () => {
    const job = await createJob(versionUser.token);

    const foreign = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${otherVersion.id}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: job.id })
      .expect(404);
    expectApiError(foreign, 404, `/v1/resume-versions/${otherVersion.id}/analyze`);

    const missingId = randomUUID();
    const missing = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${missingId}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: job.id })
      .expect(404);
    expectApiError(missing, 404, `/v1/resume-versions/${missingId}/analyze`);
  });

  it('POST analyze sem jobId no body responde 400', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Sem jobId'),
    });
    const version = await createVersion(versionUser.token, resume.id);

    const response = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${version.id}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({})
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/resume-versions/${version.id}/analyze`,
    );
    expect(errorMentions(body, 'jobId')).toBe(true);
  });

  it.each(['score', 'resumeVersionId', 'userId'])(
    'POST analyze rejeita campo fora da whitelist (%s) com 400',
    async (field) => {
      const resume = await createResume(versionUser.token, {
        name: uniqueName('Extra'),
      });
      const version = await createVersion(versionUser.token, resume.id);
      const job = await createJob(versionUser.token);

      const response = await request(app.getHttpServer())
        .post(`/v1/resume-versions/${version.id}/analyze`)
        .set('Authorization', authorization(versionUser.token))
        .send({ jobId: job.id, [field]: 'hack' })
        .expect(400);

      const body = expectApiError(
        response,
        400,
        `/v1/resume-versions/${version.id}/analyze`,
      );
      expect(errorMentions(body, field)).toBe(true);
    },
  );

  it('POST /v1/resume-versions/:id/analyze com id não-UUID responde 400', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${NOT_A_UUID}/analyze`)
      .set('Authorization', authorization(versionUser.token))
      .send({ jobId: randomUUID() })
      .expect(400);

    expectApiError(
      response,
      400,
      `/v1/resume-versions/${NOT_A_UUID}/analyze`,
    );
  });

  // ------------------------------------ 8. GET /v1/resume-versions/:id/analysis

  it('GET /v1/resume-versions/:id/analysis devolve a análise persistida', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Consulta análise'),
    });
    const version = await createVersion(versionUser.token, resume.id);
    const job = await createJob(versionUser.token);
    const created = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}/analysis`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    const body = response.body as AnalysisBody;

    expect(body.id).toBe(created.id);
    expect(body.resumeVersionId).toBe(version.id);
    expect(body.jobId).toBe(job.id);
    expect(body.score).toBe(created.score);
    expect(body.breakdown).toHaveLength(DIMENSIONS.length);
    expect(body.checks).toHaveLength(CHECK_IDS.length);
  });

  it('GET analysis sem análise responde 404', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Sem análise'),
    });
    const version = await createVersion(versionUser.token, resume.id);

    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}/analysis`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);

    expectApiError(
      response,
      404,
      `/v1/resume-versions/${version.id}/analysis`,
    );
  });

  it('GET analysis de versão alheia responde 404', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${otherVersion.id}/analysis`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);

    expectApiError(
      response,
      404,
      `/v1/resume-versions/${otherVersion.id}/analysis`,
    );
  });

  it('GET analysis com id não-UUID responde 400', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${NOT_A_UUID}/analysis`)
      .set('Authorization', authorization(versionUser.token))
      .expect(400);

    expectApiError(
      response,
      400,
      `/v1/resume-versions/${NOT_A_UUID}/analysis`,
    );
  });

  // ------------------------------------------------- 9. Isolamento entre users

  it('usuário B nunca acessa currículo, versão ou análise do usuário A', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Isolamento'),
    });
    const version = await createVersion(versionUser.token, resume.id);
    const job = await createJob(versionUser.token);
    const analysis = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });

    expect(analysis.id).toBeDefined();

    const resumeGet = await request(app.getHttpServer())
      .get(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);
    expectApiError(resumeGet, 404, `/v1/resumes/${resume.id}`);

    const resumePatch = await request(app.getHttpServer())
      .patch(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(otherUser.token))
      .send({ name: 'Invasor' })
      .expect(404);
    expectApiError(resumePatch, 404, `/v1/resumes/${resume.id}`);

    const resumeDelete = await request(app.getHttpServer())
      .delete(`/v1/resumes/${resume.id}`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);
    expectApiError(resumeDelete, 404, `/v1/resumes/${resume.id}`);

    const versionGet = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);
    expectApiError(versionGet, 404, `/v1/resume-versions/${version.id}`);

    const versionAnalyze = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${version.id}/analyze`)
      .set('Authorization', authorization(otherUser.token))
      .send({ jobId: otherJob.id })
      .expect(404);
    expectApiError(
      versionAnalyze,
      404,
      `/v1/resume-versions/${version.id}/analyze`,
    );

    const analysisGet = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}/analysis`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);
    expectApiError(
      analysisGet,
      404,
      `/v1/resume-versions/${version.id}/analysis`,
    );

    const generateOnForeign = await request(app.getHttpServer())
      .post(`/v1/resumes/${resume.id}/versions`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);
    expectApiError(
      generateOnForeign,
      404,
      `/v1/resumes/${resume.id}/versions`,
    );
  });

  // ------------------------------- 10. DELETE /v1/jobs/:id e versões do currículo

  it('DELETE /v1/jobs/:id com análise ATS responde 409 e preserva vaga e versão', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga com análise'),
    });
    const job = await createJob(versionUser.token);
    const version = await createVersion(versionUser.token, resume.id, {
      jobId: job.id,
    });
    const analysis = await analyze(versionUser.token, version.id, {
      jobId: job.id,
    });

    expect(analysis.jobId).toBe(job.id);

    const response = await request(app.getHttpServer())
      .delete(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(409);

    const body = expectApiError(response, 409, `/v1/jobs/${job.id}`);

    expect(body.message).toBe('Cannot delete job with ATS analyses');

    await request(app.getHttpServer())
      .get(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    const versionAfter = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    expect((versionAfter.body as ResumeVersionBody).jobId).toBe(job.id);
  });

  it('DELETE /v1/jobs/:id com versão e sem análise responde 204 e zera job_id da versão', async () => {
    const resume = await createResume(versionUser.token, {
      name: uniqueName('Vaga com versão'),
    });
    const job = await createJob(versionUser.token);
    const version = await createVersion(versionUser.token, resume.id, {
      jobId: job.id,
    });

    expect(version.jobId).toBe(job.id);

    const response = await request(app.getHttpServer())
      .delete(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(204);

    expect(response.text).toBe('');

    const versionAfter = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${version.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(200);

    expect((versionAfter.body as ResumeVersionBody).jobId).toBeNull();

    const rows = (await app.get(DataSource).query(
      'SELECT job_id FROM resume_versions WHERE id = ?',
      [version.id],
    )) as Array<{ job_id: string | null }>;

    expect(rows[0]?.job_id).toBeNull();

    await request(app.getHttpServer())
      .get(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);
  });

  it('DELETE /v1/jobs/:id sem versão nem análise responde 204', async () => {
    const job = await createJob(versionUser.token);

    const response = await request(app.getHttpServer())
      .delete(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(204);

    expect(response.text).toBe('');

    await request(app.getHttpServer())
      .get(`/v1/jobs/${job.id}`)
      .set('Authorization', authorization(versionUser.token))
      .expect(404);
  });
});
