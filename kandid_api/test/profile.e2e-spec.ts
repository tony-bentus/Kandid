import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  type ProfileResponse,
  type TestUser,
} from './helpers/auth.js';
import { errorMentions, expectApiError } from './helpers/response.js';

const EMAIL_PREFIX = 'profiles-e2e';

const BASELINE = {
  headline: 'Backend Developer',
  summary: 'Resumo inicial do perfil.',
  city: 'São Paulo',
  state: 'SP',
  desiredRole: 'Desenvolvedor Backend Sênior',
  desiredSalaryCents: 1_500_000,
  linkedinUrl: 'https://linkedin.com/in/qa-candidato',
};

describe('KAN-13 — Perfil (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let otherUser: TestUser;
  let noProfileUser: TestUser;
  let newUser: TestUser;
  let profile: ProfileResponse;

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
    newUser = await registerTestUser(app, EMAIL_PREFIX);
    profile = await createTestProfile(app, user.token, BASELINE);
    await createTestProfile(app, otherUser.token, {
      headline: 'Outro candidato',
    });
  });

  afterAll(async () => {
    try {
      await deleteUsersByEmailPrefix(app, EMAIL_PREFIX);
    } finally {
      await app.close();
    }
  });

  it('GET /v1/me/profile responde 404 sem perfil e não cria perfil como efeito colateral', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(noProfileUser.token))
      .expect(404);

    const body = expectApiError(response, 404, '/v1/me/profile');
    expect(body.message).toBeTruthy();

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM profiles WHERE user_id = ?',
      [noProfileUser.userId],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(0);
  });

  it('GET /v1/me/profile responde 401 sem token', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .expect(401);

    const body = expectApiError(response, 401, '/v1/me/profile');
    expect(body.message).toBe('Invalid or missing access token');
  });

  it('GET /v1/me/profile responde 401 com token inválido', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expectApiError(response, 401, '/v1/me/profile');
  });

  it('PATCH /v1/me/profile responde 401 sem token', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .send({ headline: 'Sem autorização' })
      .expect(401);

    expectApiError(response, 401, '/v1/me/profile');
  });

  it('PATCH /v1/me/profile cria o perfil com userId do JWT e currency BRL default', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(newUser.token))
      .send({ headline: 'Primeiro perfil' })
      .expect(200);

    const body = response.body as ProfileResponse;

    expect(body.id).toBeDefined();
    expect(body.userId).toBe(newUser.userId);
    expect(body.currency).toBe('BRL');
    expect(body.headline).toBe('Primeiro perfil');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();

    const payload = app
      .get(JwtService)
      .decode<{ sub: string; email: string }>(newUser.token);

    expect(payload?.sub).toBe(body.userId);
    expect(payload?.email).toBe(newUser.email);
  });

  it('GET /v1/me/profile reflete a persistência sem expor dados de autenticação', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .expect(200);

    const body = response.body as ProfileResponse;

    expect(body).toMatchObject({
      id: profile.id,
      userId: user.userId,
      headline: BASELINE.headline,
      summary: BASELINE.summary,
      city: BASELINE.city,
      state: BASELINE.state,
      desiredRole: BASELINE.desiredRole,
      desiredSalaryCents: BASELINE.desiredSalaryCents,
      linkedinUrl: BASELINE.linkedinUrl,
      currency: 'BRL',
    });
    expect(body).not.toHaveProperty('user');
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('password_hash');
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('PATCH parcial altera somente o campo enviado', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ headline: 'Staff Engineer' })
      .expect(200);

    const body = response.body as ProfileResponse;

    expect(body.headline).toBe('Staff Engineer');
    expect(body.summary).toBe(BASELINE.summary);
    expect(body.city).toBe(BASELINE.city);
    expect(body.state).toBe(BASELINE.state);
    expect(body.desiredRole).toBe(BASELINE.desiredRole);
    expect(body.desiredSalaryCents).toBe(BASELINE.desiredSalaryCents);
    expect(body.linkedinUrl).toBe(BASELINE.linkedinUrl);
    expect(body.currency).toBe('BRL');

    const reread = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((reread.body as ProfileResponse).headline).toBe('Staff Engineer');
  });

  it('PATCH com null explícito limpa o campo opcional', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ linkedinUrl: null })
      .expect(200);

    expect((response.body as ProfileResponse).linkedinUrl).toBeNull();

    const reread = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect((reread.body as ProfileResponse).linkedinUrl).toBeNull();
  });

  it('PATCH com string vazia normaliza o campo opcional para null', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ city: '' })
      .expect(200);

    expect((response.body as ProfileResponse).city).toBeNull();
  });

  it('PATCH aceita currency explícita diferente do default', async () => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ currency: 'USD' })
      .expect(200);

    expect((response.body as ProfileResponse).currency).toBe('USD');
  });

  it('PATCH converte desiredSalaryCents alto (bigint) em número JSON', async () => {
    const salary = 9_000_000_000_000;
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ desiredSalaryCents: salary })
      .expect(200);

    expect((response.body as ProfileResponse).desiredSalaryCents).toBe(salary);
  });

  it.each([
    { field: 'desiredSalaryCents', value: -1 },
    { field: 'currency', value: 'brl' },
    { field: 'currency', value: 'BRL1' },
    { field: 'linkedinUrl', value: 'linkedin.com/in/qa' },
    { field: 'githubUrl', value: 'ftp://github.com/qa' },
    { field: 'portfolioUrl', value: 'not a url' },
    { field: 'availableFrom', value: '2026-12-01T00:00:00.000Z' },
    { field: 'availableFrom', value: '2026-02-31' },
    { field: 'currency', value: null },
  ])('PATCH /v1/me/profile rejeita $field=$value com 400', async ({ field, value }) => {
    const response = await request(app.getHttpServer())
      .patch('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .send({ [field]: value })
      .expect(400);

    const body = expectApiError(response, 400, '/v1/me/profile');
    expect(errorMentions(body, field)).toBe(true);
  });

  it.each(['userId', 'user_id', 'profileId', 'profile_id'])(
    'PATCH /v1/me/profile rejeita campo desconhecido %s com 400 e não persiste nada',
    async (field) => {
      const before = await request(app.getHttpServer())
        .get('/v1/me/profile')
        .set('Authorization', authorization(user.token))
        .expect(200);
      const beforeHeadline = (before.body as ProfileResponse).headline;

      const response = await request(app.getHttpServer())
        .patch('/v1/me/profile')
        .set('Authorization', authorization(user.token))
        .send({ headline: 'Nunca persistir', [field]: 'hack' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/profile');
      expect(errorMentions(body, field)).toBe(true);

      const after = await request(app.getHttpServer())
        .get('/v1/me/profile')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((after.body as ProfileResponse).headline).toBe(beforeHeadline);
    },
  );

  it('dois usuários autenticados enxergam apenas o próprio perfil', async () => {
    const first = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(user.token))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/v1/me/profile')
      .set('Authorization', authorization(otherUser.token))
      .expect(200);

    const firstBody = first.body as ProfileResponse;
    const secondBody = second.body as ProfileResponse;

    expect(firstBody.userId).toBe(user.userId);
    expect(secondBody.userId).toBe(otherUser.userId);
    expect(firstBody.id).not.toBe(secondBody.id);
    expect(firstBody.id).toBe(profile.id);
  });
});
