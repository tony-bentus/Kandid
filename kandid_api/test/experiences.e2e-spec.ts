import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
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
import { errorMentions, expectApiError } from './helpers/response.js';

const EMAIL_PREFIX = 'experiences-e2e';

interface Bullet {
  id: string;
  experienceId: string;
  text: string;
  sortOrder: number;
  [key: string]: unknown;
}

interface Experience {
  id: string;
  profileId: string;
  companyName: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  sortOrder: number;
  bullets: Bullet[];
  [key: string]: unknown;
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyName: 'Acme',
    role: 'Backend Developer',
    employmentType: 'CLT',
    workModel: 'REMOTE',
    startDate: '2023-01-01',
    endDate: '2024-06-30',
    isCurrent: false,
    ...overrides,
  };
}

describe('KAN-14 — Experiências e bullets (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let otherUser: TestUser;
  let noProfileUser: TestUser;
  let orderUser: TestUser;
  let sortUser: TestUser;
  let anchor: Experience;
  let second: Experience;
  let otherUsersExperience: Experience;
  let anchorBullet: Bullet;

  async function createExperience(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Experience> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(token))
      .send(body)
      .expect(201);

    return response.body as Experience;
  }

  async function createBullet(
    token: string,
    experienceId: string,
    body: Record<string, unknown>,
  ): Promise<Bullet> {
    const response = await request(app.getHttpServer())
      .post(`/v1/me/experiences/${experienceId}/bullets`)
      .set('Authorization', authorization(token))
      .send(body)
      .expect(201);

    return response.body as Bullet;
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

    user = await registerTestUser(app, EMAIL_PREFIX);
    otherUser = await registerTestUser(app, EMAIL_PREFIX);
    noProfileUser = await registerTestUser(app, EMAIL_PREFIX);
    orderUser = await registerTestUser(app, EMAIL_PREFIX);
    sortUser = await registerTestUser(app, EMAIL_PREFIX);

    await createTestProfile(app, user.token, { headline: 'Experienced QA' });
    await createTestProfile(app, otherUser.token, { headline: 'Other QA' });
    await createTestProfile(app, orderUser.token);
    await createTestProfile(app, sortUser.token);

    anchor = await createExperience(user.token, payload());
    second = await createExperience(
      user.token,
      payload({ companyName: 'Globex', startDate: '2020-01-01', sortOrder: 1 }),
    );
    otherUsersExperience = await createExperience(otherUser.token, payload());
    anchorBullet = await createBullet(user.token, anchor.id, {
      text: 'Entreguei a migração da API.',
    });
  });

  afterAll(async () => {
    try {
      await deleteUsersByEmailPrefix(app, EMAIL_PREFIX);
    } finally {
      await app.close();
    }
  });

  it('POST /v1/me/experiences sem perfil responde 404 e não cria experiência', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(noProfileUser.token))
      .send(payload())
      .expect(404);

    const body = expectApiError(response, 404, '/v1/me/experiences');
    expect(body.message).toBeTruthy();

    const rows = (await app.get(DataSource).query(
      `SELECT COUNT(*) AS total FROM experiences e
       JOIN profiles p ON p.id = e.profile_id
       WHERE p.user_id = ?`,
      [noProfileUser.userId],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(0);
  });

  it('GET /v1/me/experiences sem perfil responde 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(noProfileUser.token))
      .expect(404);

    expectApiError(response, 404, '/v1/me/experiences');
  });

  it('POST /v1/me/experiences cria com 201, bullets vazias e sortOrder preenchido', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send(payload({ companyName: 'Initech' }))
      .expect(201);

    const body = response.body as Experience;

    expect(body.id).toBeDefined();
    expect(body.profileId).toBe(anchor.profileId);
    expect(body.companyName).toBe('Initech');
    expect(body.role).toBe('Backend Developer');
    expect(body.startDate).toBe('2023-01-01');
    expect(body.endDate).toBe('2024-06-30');
    expect(body.isCurrent).toBe(false);
    expect(typeof body.sortOrder).toBe('number');
    expect(body.sortOrder).toBeGreaterThanOrEqual(0);
    expect(body.bullets).toEqual([]);
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('POST /v1/me/experiences sem sortOrder usa MAX(sort_order) + 1', async () => {
    const first = await createExperience(sortUser.token, payload());
    const next = await createExperience(
      sortUser.token,
      payload({ companyName: 'Globex' }),
    );

    expect(next.sortOrder).toBeGreaterThan(first.sortOrder);
  });

  it('GET /v1/me/experiences/:id devolve a experiência persistida com suas bullets', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .expect(200);

    const body = response.body as Experience;

    expect(body.id).toBe(anchor.id);
    expect(body.companyName).toBe('Acme');
    expect(body.bullets).toHaveLength(1);
    expect(body.bullets[0]?.id).toBe(anchorBullet.id);
    expect(body.bullets[0]?.experienceId).toBe(anchor.id);
  });

  it('PATCH /v1/me/experiences/:id atualiza parcialmente', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .send({ role: 'Tech Lead' })
      .expect(200);

    const body = response.body as Experience;

    expect(body.role).toBe('Tech Lead');
    expect(body.companyName).toBe('Acme');
    expect(body.startDate).toBe('2023-01-01');
  });

  it('POST rejeita isCurrent=true com endDate preenchida', async () => {
    const before = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send(payload({ isCurrent: true, endDate: '2024-06-30' }))
      .expect(400);

    expectApiError(response, 400, '/v1/me/experiences');

    const after = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((after.body as Experience[])).toHaveLength(
      (before.body as Experience[]).length,
    );
  });

  it('PATCH rejeita isCurrent=true com endDate preenchida e não persiste', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .send({ isCurrent: true, endDate: '2025-01-01' })
      .expect(400);

    expectApiError(response, 400, `/v1/me/experiences/${anchor.id}`);

    const reread = await request(app.getHttpServer())
      .get(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((reread.body as Experience).isCurrent).toBe(false);
    expect((reread.body as Experience).endDate).toBe('2024-06-30');
  });

  it('POST rejeita isCurrent=false sem endDate com mensagem sobre endDate', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send(payload({ endDate: undefined, isCurrent: false }))
      .expect(400);

    const body = expectApiError(response, 400, '/v1/me/experiences');
    expect(errorMentions(body, 'endDate')).toBe(true);
  });

  it('PATCH parcial rejeita isCurrent=false sem endDate', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .send({ endDate: null, isCurrent: false })
      .expect(400);

    expectApiError(response, 400, `/v1/me/experiences/${anchor.id}`);
  });

  it('POST rejeita endDate anterior a startDate', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send(payload({ startDate: '2023-01-01', endDate: '2022-12-31' }))
      .expect(400);

    expectApiError(response, 400, '/v1/me/experiences');
  });

  it('PATCH parcial rejeita endDate anterior a startDate', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .send({ endDate: '2001-01-01' })
      .expect(400);

    expectApiError(response, 400, `/v1/me/experiences/${anchor.id}`);
  });

  it.each([
    { field: 'startDate', value: '2023-01-01T00:00:00.000Z' },
    { field: 'startDate', value: '01/01/2023' },
    { field: 'startDate', value: '2023-02-31' },
    { field: 'endDate', value: '2024-06-30T12:00:00Z' },
  ])('POST rejeita $field inválido ($value) com 400', async ({ field, value }) => {
    const response = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send(payload({ [field]: value }))
      .expect(400);

    const body = expectApiError(response, 400, '/v1/me/experiences');
    expect(errorMentions(body, field)).toBe(true);
  });

  it('PATCH parcial com data inválida responde 400', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}`)
      .set('Authorization', authorization(user.token))
      .send({ startDate: '2023/01/01' })
      .expect(400);

    const body = expectApiError(response, 400, `/v1/me/experiences/${anchor.id}`);
    expect(errorMentions(body, 'startDate')).toBe(true);
  });

  it.each(['profile_id', 'user_id', 'profileId'])(
    'POST /v1/me/experiences rejeita campo desconhecido %s com 400',
    async (field) => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/experiences')
        .set('Authorization', authorization(user.token))
        .send(payload({ [field]: user.userId }))
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/experiences');
      expect(errorMentions(body, field)).toBe(true);
    },
  );

  it.each([
    {
      label: 'GET lista',
      path: () => '/v1/me/experiences',
      run: async () => request(app.getHttpServer()).get('/v1/me/experiences'),
    },
    {
      label: 'GET por id',
      path: () => `/v1/me/experiences/${anchor.id}`,
      run: async () =>
        request(app.getHttpServer()).get(`/v1/me/experiences/${anchor.id}`),
    },
    {
      label: 'POST',
      path: () => '/v1/me/experiences',
      run: async () =>
        request(app.getHttpServer())
          .post('/v1/me/experiences')
          .send(payload()),
    },
    {
      label: 'PATCH',
      path: () => `/v1/me/experiences/${anchor.id}`,
      run: async () =>
        request(app.getHttpServer())
          .patch(`/v1/me/experiences/${anchor.id}`)
          .send({ role: 'QA' }),
    },
    {
      label: 'DELETE',
      path: () => `/v1/me/experiences/${anchor.id}`,
      run: async () =>
        request(app.getHttpServer()).delete(`/v1/me/experiences/${anchor.id}`),
    },
    {
      label: 'POST bullet',
      path: () => `/v1/me/experiences/${anchor.id}/bullets`,
      run: async () =>
        request(app.getHttpServer())
          .post(`/v1/me/experiences/${anchor.id}/bullets`)
          .send({ text: 'Bullet' }),
    },
    {
      label: 'PATCH bullet',
      path: () =>
        `/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`,
      run: async () =>
        request(app.getHttpServer())
          .patch(
            `/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`,
          )
          .send({ text: 'Bullet' }),
    },
    {
      label: 'DELETE bullet',
      path: () =>
        `/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`,
      run: async () =>
        request(app.getHttpServer()).delete(
          `/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`,
        ),
    },
  ])('$label de experiência sem token responde 401', async ({ path, run }) => {
    const raw = await run();

    expectApiError({ status: raw.status, body: raw.body }, 401, path());
  });

  it('GET/PATCH/DELETE de experiência de outro usuário respondem 404', async () => {
    const id = otherUsersExperience.id;

    await request(app.getHttpServer())
      .get(`/v1/me/experiences/${id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${id}`)
      .set('Authorization', authorization(user.token))
      .send({ role: 'Invasor' })
      .expect(404);

    const del = await request(app.getHttpServer())
      .delete(`/v1/me/experiences/${id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);

    expectApiError(del, 404, `/v1/me/experiences/${id}`);
  });

  it('listagens de dois usuários são isoladas', async () => {
    const first = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .expect(200);
    const otherList = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(otherUser.token))
      .expect(200);

    const firstIds = (first.body as Experience[]).map((item) => item.id);
    const secondIds = (otherList.body as Experience[]).map((item) => item.id);

    expect(firstIds).toContain(anchor.id);
    expect(firstIds).toContain(second.id);
    expect(secondIds).toEqual([otherUsersExperience.id]);
    expect(firstIds).not.toContain(otherUsersExperience.id);
  });

  it('GET /v1/me/experiences ordena por sortOrder e startDate descendente', async () => {
    const otherOrder = await createExperience(orderUser.token, payload({
      companyName: 'Sort 1',
      startDate: '2020-01-01',
      sortOrder: 1,
    }));
    const olderSameOrder = await createExperience(orderUser.token, payload({
      companyName: 'Sort 0 antiga',
      startDate: '2019-01-01',
      sortOrder: 0,
    }));
    const newerSameOrder = await createExperience(orderUser.token, payload({
      companyName: 'Sort 0 recente',
      startDate: '2023-01-01',
      sortOrder: 0,
    }));

    const response = await request(app.getHttpServer())
      .get('/v1/me/experiences')
      .set('Authorization', authorization(orderUser.token))
      .expect(200);

    expect((response.body as Experience[]).map((item) => item.id)).toEqual([
      newerSameOrder.id,
      olderSameOrder.id,
      otherOrder.id,
    ]);
  });

  it('POST bullet cria vinculada à experiência com sortOrder default', async () => {
    const bullet = await createBullet(user.token, second.id, {
      text: 'Reduzi o tempo de resposta da API em 40%.',
    });

    expect(bullet.id).toBeDefined();
    expect(bullet.experienceId).toBe(second.id);
    expect(bullet.text).toBe('Reduzi o tempo de resposta da API em 40%.');
    expect(bullet.sortOrder).toBeGreaterThanOrEqual(0);
    expect(bullet.createdAt).toBeDefined();
  });

  it.each([
    { label: 'texto vazio', text: '' },
    { label: 'somente espaços', text: '   ' },
    { label: 'acima de 500 caracteres', text: 'a'.repeat(501) },
  ])('POST bullet rejeita $label com 400', async ({ text }) => {
    const response = await request(app.getHttpServer())
      .post(`/v1/me/experiences/${anchor.id}/bullets`)
      .set('Authorization', authorization(user.token))
      .send({ text })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/me/experiences/${anchor.id}/bullets`,
    );
    expect(errorMentions(body, 'text')).toBe(true);
  });

  it('POST bullet rejeita campo desconhecido profileId com 400', async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/me/experiences/${anchor.id}/bullets`)
      .set('Authorization', authorization(user.token))
      .send({ text: 'Válida', profileId: anchor.profileId })
      .expect(400);

    const body = expectApiError(
      response,
      400,
      `/v1/me/experiences/${anchor.id}/bullets`,
    );
    expect(errorMentions(body, 'profileId')).toBe(true);
  });

  it('PATCH bullet atualiza o texto', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`)
      .set('Authorization', authorization(user.token))
      .send({ text: 'Texto atualizado da bullet.' })
      .expect(200);

    expect((response.body as Bullet).text).toBe('Texto atualizado da bullet.');
    expect((response.body as Bullet).id).toBe(anchorBullet.id);
  });

  it('DELETE bullet responde 204 sem corpo e remove a bullet', async () => {
    const disposable = await createBullet(user.token, second.id, {
      text: 'Bullet descartável',
    });

    const response = await request(app.getHttpServer())
      .delete(`/v1/me/experiences/${second.id}/bullets/${disposable.id}`)
      .set('Authorization', authorization(user.token))
      .expect(204);

    expect(response.text).toBe('');

    await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${second.id}/bullets/${disposable.id}`)
      .set('Authorization', authorization(user.token))
      .send({ text: 'Não deve existir' })
      .expect(404);
  });

  it('PATCH/DELETE com :id de outra experiência do mesmo usuário respondem 404', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${second.id}/bullets/${anchorBullet.id}`)
      .set('Authorization', authorization(user.token))
      .send({ text: 'Errado' })
      .expect(404);

    const del = await request(app.getHttpServer())
      .delete(`/v1/me/experiences/${second.id}/bullets/${anchorBullet.id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);

    expectApiError(
      del,
      404,
      `/v1/me/experiences/${second.id}/bullets/${anchorBullet.id}`,
    );
  });

  it('bullet de outro usuário responde 404 mesmo com a experiência correta', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`)
      .set('Authorization', authorization(otherUser.token))
      .send({ text: 'Invasor' })
      .expect(404);

    expectApiError(
      response,
      404,
      `/v1/me/experiences/${anchor.id}/bullets/${anchorBullet.id}`,
    );
  });

  it('DELETE /v1/me/experiences/:id responde 204 sem corpo e remove bullets em cascata', async () => {
    const disposable = await createExperience(user.token, payload());
    const bullet = await createBullet(user.token, disposable.id, {
      text: 'Bullet em cascata',
    });

    const response = await request(app.getHttpServer())
      .delete(`/v1/me/experiences/${disposable.id}`)
      .set('Authorization', authorization(user.token))
      .expect(204);

    expect(response.text).toBe('');

    await request(app.getHttpServer())
      .get(`/v1/me/experiences/${disposable.id}`)
      .set('Authorization', authorization(user.token))
      .expect(404);

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM experience_bullets WHERE id = ?',
      [bullet.id],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(0);
  });
});
