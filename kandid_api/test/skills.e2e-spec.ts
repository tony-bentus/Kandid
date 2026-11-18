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

const EMAIL_PREFIX = 'skills-e2e';
const CURRENT_YEAR = new Date().getUTCFullYear();

interface CatalogSkill {
  id: string;
  name: string;
  slug: string;
  category: string;
  aliases: string[];
  [key: string]: unknown;
}

interface ProfileSkill {
  id: string;
  profileId: string;
  skillId: string;
  level: string;
  yearsExperience: number | null;
  lastUsedYear: number | null;
  skill: CatalogSkill;
  [key: string]: unknown;
}

describe('KAN-15 — Catálogo e vínculo de skills (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let otherUser: TestUser;
  let noProfileUser: TestUser;
  let nodeId: string;
  let postgresId: string;
  let k8sId: string;
  let jsId: string;
  let userSkill: ProfileSkill;

  /** Localiza a skill semeada por nome ou alias, sem depender de ordenação da API. */
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

    if (!match) {
      throw new Error(`O seed do catálogo não contém a skill/alias "${term}"`);
    }

    return match.id;
  }

  async function linkSkill(
    token: string,
    skillId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<ProfileSkill> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(token))
      .send({ skillId, level: 'ADVANCED', ...overrides })
      .expect(201);

    return response.body as ProfileSkill;
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

    nodeId = await findSeededSkillId('Node.js');
    postgresId = await findSeededSkillId('postgres');
    k8sId = await findSeededSkillId('k8s');
    jsId = await findSeededSkillId('JS');

    user = await registerTestUser(app, EMAIL_PREFIX);
    otherUser = await registerTestUser(app, EMAIL_PREFIX);
    noProfileUser = await registerTestUser(app, EMAIL_PREFIX);
    await createTestProfile(app, user.token, { headline: 'Node Developer' });
    await createTestProfile(app, otherUser.token, { headline: 'Other Dev' });
    userSkill = await linkSkill(user.token, nodeId, {
      yearsExperience: 5.5,
      lastUsedYear: CURRENT_YEAR,
    });
  });

  afterAll(async () => {
    try {
      await deleteUsersByEmailPrefix(app, EMAIL_PREFIX);
    } finally {
      await app.close();
    }
  });

  it('GET /v1/skills sem q devolve até 20 skills ordenadas por nome', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .set('Authorization', authorization(user.token))
      .expect(200);

    const body = response.body as CatalogSkill[];

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(20);
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      category: expect.any(String),
    });
    expect(Array.isArray(body[0]?.aliases)).toBe(true);

    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    const names = body.map((skill) => skill.name);
    expect(names).toEqual([...names].sort(collator.compare));
  });

  it('GET /v1/skills?q=node encontra a skill pelo nome', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ q: 'node' })
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((response.body as CatalogSkill[]).map((skill) => skill.id)).toContain(
      nodeId,
    );
  });

  it('GET /v1/skills normaliza q maiúsculo (q=NODE)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ q: 'NODE' })
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((response.body as CatalogSkill[]).map((skill) => skill.id)).toContain(
      nodeId,
    );
  });

  it.each([
    { q: 'postgres', label: 'postgres', id: () => postgresId },
    { q: 'k8s', label: 'k8s', id: () => k8sId },
    { q: 'JS', label: 'JS', id: () => jsId },
  ])('GET /v1/skills?q=$q encontra a skill pelo alias $label', async ({ q, id }) => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ q })
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((response.body as CatalogSkill[]).map((skill) => skill.id)).toContain(
      id(),
    );
  });

  it('GET /v1/skills ordena match exato antes de contém (q=JS)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ q: 'JS' })
      .set('Authorization', authorization(user.token))
      .expect(200);

    const ids = (response.body as CatalogSkill[]).map((skill) => skill.id);
    const exactIndex = ids.indexOf(jsId);
    const containsIndex = ids.indexOf(nodeId);

    expect(exactIndex).toBeGreaterThanOrEqual(0);
    expect(containsIndex).toBeGreaterThanOrEqual(0);
    expect(exactIndex).toBeLessThan(containsIndex);
  });

  it('GET /v1/skills respeita limit explícito', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ limit: 3 })
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((response.body as CatalogSkill[]).length).toBeLessThanOrEqual(3);
  });

  it.each([0, 51])('GET /v1/skills?limit=%s responde 400', async (limit) => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ limit })
      .set('Authorization', authorization(user.token))
      .expect(400);

    const body = expectApiError(response, 400, `/v1/skills?limit=${limit}`);
    expect(errorMentions(body, 'limit')).toBe(true);
  });

  it('GET /v1/skills rejeita q acima de 80 caracteres com 400', async () => {
    const q = 'a'.repeat(81);
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .query({ q })
      .set('Authorization', authorization(user.token))
      .expect(400);

    const body = expectApiError(response, 400, `/v1/skills?q=${q}`);
    expect(errorMentions(body, 'q')).toBe(true);
  });

  it('POST /v1/me/skills vincula skill com os dados do catálogo', async () => {
    const created = await linkSkill(user.token, postgresId, {
      level: 'EXPERT',
      yearsExperience: 5.5,
      lastUsedYear: CURRENT_YEAR,
    });

    expect(created.id).toBeDefined();
    expect(created.profileId).toBe(userSkill.profileId);
    expect(created.skillId).toBe(postgresId);
    expect(created.level).toBe('EXPERT');
    expect(created.yearsExperience).toBe(5.5);
    expect(created.lastUsedYear).toBe(CURRENT_YEAR);
    expect(created.skill).toMatchObject({ id: postgresId });
    expect(created.skill.name).toBeDefined();
    expect(created.skill.slug).toBeDefined();
    expect(created.skill.category).toBeDefined();
    expect(Array.isArray(created.skill.aliases)).toBe(true);
  });

  it('POST /v1/me/skills duplicado responde 409 sem criar outro vínculo', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .send({ skillId: userSkill.skillId, level: 'ADVANCED' })
      .expect(409);

    expectApiError(response, 409, '/v1/me/skills');

    const list = await request(app.getHttpServer())
      .get('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect(
      (list.body as ProfileSkill[]).filter(
        (item) => item.skillId === userSkill.skillId,
      ),
    ).toHaveLength(1);
  });

  it('POST /v1/me/skills com skill inexistente responde 404', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .send({ skillId: randomUUID(), level: 'ADVANCED' })
      .expect(404);

    expectApiError(response, 404, '/v1/me/skills');
  });

  it.each([5.55, 100, -1])(
    'POST /v1/me/skills rejeita yearsExperience=%s com 400',
    async (yearsExperience) => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/skills')
        .set('Authorization', authorization(user.token))
        .send({ skillId: k8sId, level: 'ADVANCED', yearsExperience })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/skills');
      expect(errorMentions(body, 'yearsExperience')).toBe(true);
    },
  );

  it('POST /v1/me/skills rejeita lastUsedYear futuro com 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .send({
        skillId: k8sId,
        level: 'ADVANCED',
        lastUsedYear: CURRENT_YEAR + 1,
      })
      .expect(400);

    expectApiError(response, 400, '/v1/me/skills');
  });

  it('POST /v1/me/skills rejeita nível fora do enum com 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .send({ skillId: k8sId, level: 'GURU' })
      .expect(400);

    const body = expectApiError(response, 400, '/v1/me/skills');
    expect(errorMentions(body, 'level')).toBe(true);
  });

  it.each(['profile_id', 'user_id', 'profileId'])(
    'POST /v1/me/skills rejeita campo desconhecido %s com 400',
    async (field) => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/skills')
        .set('Authorization', authorization(user.token))
        .send({ skillId: k8sId, level: 'ADVANCED', [field]: 'hack' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/skills');
      expect(errorMentions(body, field)).toBe(true);
    },
  );

  it('PATCH /v1/me/skills/:id atualiza level e anos de experiência', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/skills/${userSkill.id}`)
      .set('Authorization', authorization(user.token))
      .send({ level: 'EXPERT', yearsExperience: 7.2 })
      .expect(200);

    const body = response.body as ProfileSkill;

    expect(body.id).toBe(userSkill.id);
    expect(body.level).toBe('EXPERT');
    expect(body.yearsExperience).toBe(7.2);
    expect(body.skillId).toBe(userSkill.skillId);
  });

  it('PATCH /v1/me/skills/:id rejeita skillId com 400', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/skills/${userSkill.id}`)
      .set('Authorization', authorization(user.token))
      .send({ skillId: k8sId })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/me/skills/${userSkill.id}`,
    );
    expect(errorMentions(body, 'skillId')).toBe(true);
  });

  it.each([
    { field: 'yearsExperience', value: 5.55 },
    { field: 'lastUsedYear', value: CURRENT_YEAR + 1 },
    { field: 'user_id', value: 'hack' },
  ])('PATCH /v1/me/skills/:id rejeita $field inválido com 400', async ({ field, value }) => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/skills/${userSkill.id}`)
      .set('Authorization', authorization(user.token))
      .send({ [field]: value })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/me/skills/${userSkill.id}`,
    );
    expect(errorMentions(body, field)).toBe(true);
  });

  it('PATCH/DELETE de vínculo de outro usuário respondem 404', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/me/skills/${userSkill.id}`)
      .set('Authorization', authorization(otherUser.token))
      .send({ level: 'BEGINNER' })
      .expect(404);

    const del = await request(app.getHttpServer())
      .delete(`/v1/me/skills/${userSkill.id}`)
      .set('Authorization', authorization(otherUser.token))
      .expect(404);

    expectApiError(del, 404, `/v1/me/skills/${userSkill.id}`);
  });

  it('listagens de vínculos são isoladas entre usuários', async () => {
    await linkSkill(otherUser.token, k8sId);

    const first = await request(app.getHttpServer())
      .get('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/v1/me/skills')
      .set('Authorization', authorization(otherUser.token))
      .expect(200);

    const firstIds = (first.body as ProfileSkill[]).map((item) => item.id);
    const secondIds = (second.body as ProfileSkill[]).map((item) => item.id);

    expect(firstIds).toContain(userSkill.id);
    expect(secondIds).not.toContain(userSkill.id);
    expect(secondIds).toHaveLength(1);
  });

  it('GET/POST /v1/me/skills sem perfil respondem 404', async () => {
    await request(app.getHttpServer())
      .get('/v1/me/skills')
      .set('Authorization', authorization(noProfileUser.token))
      .expect(404);

    const post = await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(noProfileUser.token))
      .send({ skillId: nodeId, level: 'ADVANCED' })
      .expect(404);

    expectApiError(post, 404, '/v1/me/skills');
  });

  it.each([
    {
      label: 'GET catálogo',
      path: '/v1/skills',
      run: async () => request(app.getHttpServer()).get('/v1/skills'),
    },
    {
      label: 'GET vínculos',
      path: '/v1/me/skills',
      run: async () => request(app.getHttpServer()).get('/v1/me/skills'),
    },
    {
      label: 'POST vínculo',
      path: '/v1/me/skills',
      run: async () =>
        request(app.getHttpServer())
          .post('/v1/me/skills')
          .send({ skillId: nodeId, level: 'ADVANCED' }),
    },
    {
      label: 'PATCH vínculo',
      path: () => `/v1/me/skills/${userSkill.id}`,
      run: async () =>
        request(app.getHttpServer())
          .patch(`/v1/me/skills/${userSkill.id}`)
          .send({ level: 'BEGINNER' }),
    },
    {
      label: 'DELETE vínculo',
      path: () => `/v1/me/skills/${userSkill.id}`,
      run: async () =>
        request(app.getHttpServer()).delete(`/v1/me/skills/${userSkill.id}`),
    },
  ])('$label sem token responde 401', async ({ path, run }) => {
    const raw = await run();
    const expectedPath = typeof path === 'function' ? path() : path;

    expectApiError({ status: raw.status, body: raw.body }, 401, expectedPath);
  });

  it('GET /v1/skills com token inválido responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/skills')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expectApiError(response, 401, '/v1/skills');
  });

  it('DELETE /v1/me/skills/:id responde 204 sem remover a skill do catálogo', async () => {
    const disposable = await linkSkill(user.token, jsId);

    const response = await request(app.getHttpServer())
      .delete(`/v1/me/skills/${disposable.id}`)
      .set('Authorization', authorization(user.token))
      .expect(204);

    expect(response.text).toBe('');

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM skills WHERE id = ?',
      [jsId],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(1);
  });
});
