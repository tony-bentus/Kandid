import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('Auth (e2e)', () => {
  const email = `auth-e2e-${Date.now()}@example.com`;
  const missingEmail = `auth-e2e-missing-${Date.now()}@example.com`;
  const extraFieldEmail = `auth-e2e-extra-${Date.now()}@example.com`;
  const deletedEmail = `auth-e2e-deleted-${Date.now()}@example.com`;
  const mixedCaseEmail = `  AUTH-E2E-Mixed-${Date.now()}@Example.COM  `;
  const normalizedMixedCaseEmail = mixedCaseEmail.trim().toLowerCase();
  const raceEmail = `auth-e2e-race-${Date.now()}@example.com`;
  const password = 'S3curePass!';
  const name = 'Auth E2E';

  let app: INestApplication<App>;
  let accessToken = '';
  let wrongPasswordMessage: string | string[] = '';
  let wrongPasswordBody: Record<string, unknown> = {};

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
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    try {
      const dataSource = app.get(DataSource);
      await dataSource.query('DELETE FROM users WHERE email LIKE ?', [
        'auth-e2e-%',
      ]);
    } finally {
      await app.close();
    }
  });

  it('POST /v1/auth/register rejects an invalid payload with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.path).toBe('/v1/auth/register');
    expect(response.body.timestamp).toBeDefined();
    expect(Array.isArray(response.body.message)).toBe(true);
  });

  it.each([
    {
      label: 'a missing name',
      payload: {
        email: `auth-e2e-invalid-${Date.now()}-1@example.com`,
        password,
      },
      field: 'name',
    },
    {
      label: 'a name with a single character',
      payload: {
        name: 'A',
        email: `auth-e2e-invalid-${Date.now()}-2@example.com`,
        password,
      },
      field: 'name',
    },
    {
      label: 'a malformed e-mail',
      payload: {
        name,
        email: 'not-an-email',
        password,
      },
      field: 'email',
    },
    {
      label: 'a password with 7 characters',
      payload: {
        name,
        email: `auth-e2e-invalid-${Date.now()}-3@example.com`,
        password: 'a'.repeat(7),
      },
      field: 'password',
    },
    {
      label: 'a password with 129 characters',
      payload: {
        name,
        email: `auth-e2e-invalid-${Date.now()}-4@example.com`,
        password: 'a'.repeat(129),
      },
      field: 'password',
    },
  ])(
    'POST /v1/auth/register rejects $label with 400',
    async ({ payload, field }) => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(payload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.path).toBe('/v1/auth/register');
      expect(response.body.timestamp).toBeDefined();
      expect(JSON.stringify(response.body.message)).toContain(field);
    },
  );

  it('POST /v1/auth/register rejects unknown fields with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email: extraFieldEmail, password, role: 'admin' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.path).toBe('/v1/auth/register');
    expect(response.body.timestamp).toBeDefined();
    expect(JSON.stringify(response.body.message)).toContain('role');
  });

  it('POST /v1/auth/register creates the user and returns a token', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email, password })
      .expect(201);

    accessToken = response.body.accessToken as string;

    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);
    expect(response.body.user).toMatchObject({ name, email });
    expect(response.body.user.id).toBeDefined();
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');

    // Timestamps must be UTC: a local-time offset would shift them by hours.
    expect(
      Math.abs(Date.parse(response.body.user.createdAt as string) - Date.now()),
    ).toBeLessThan(60_000);
    expect(
      Math.abs(Date.parse(response.body.user.updatedAt as string) - Date.now()),
    ).toBeLessThan(60_000);

    const jwtService = app.get(JwtService);
    const payload = jwtService.decode<{ sub: string; email: string }>(
      accessToken,
    );

    expect(payload?.sub).toBe(response.body.user.id);
    expect(payload?.email).toBe(email);

    const dataSource = app.get(DataSource);
    const rows = (await dataSource.query(
      'SELECT password_hash FROM users WHERE email = ?',
      [email],
    )) as Array<{ password_hash: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    expect(rows[0]?.password_hash).not.toBe(password);
    expect(JSON.stringify(response.body)).not.toContain(
      rows[0]?.password_hash,
    );
  });

  it('POST /v1/auth/register rejects a duplicated e-mail with 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email, password })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
      path: '/v1/auth/register',
    });
    expect(response.body.timestamp).toBeDefined();

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM users WHERE email = ?',
      [email],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('POST /v1/auth/register rejects a duplicate e-mail in another case with 409', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email: email.toUpperCase(), password })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
      path: '/v1/auth/register',
    });
  });

  it('POST /v1/auth/register maps a concurrent duplicate to 409', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ name, email: raceEmail, password }),
      request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ name, email: raceEmail, password }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);

    const rows = (await app.get(DataSource).query(
      'SELECT COUNT(*) AS total FROM users WHERE email = ?',
      [raceEmail],
    )) as Array<{ total: number | string }>;

    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('normalizes a mixed-case e-mail on register and authenticates it in lowercase', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email: mixedCaseEmail, password })
      .expect(201);

    expect(registerResponse.body.user.email).toBe(normalizedMixedCaseEmail);

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: normalizedMixedCaseEmail, password })
      .expect(200);

    expect(loginResponse.body.user.email).toBe(normalizedMixedCaseEmail);
    expect(typeof loginResponse.body.accessToken).toBe('string');
  });

  it('POST /v1/auth/login authenticates valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user.email).toBe(email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('password_hash');

    const payload = app
      .get(JwtService)
      .decode<{ iat: number; exp: number }>(response.body.accessToken);

    if (!payload) {
      throw new Error('Login did not return a decodable access token');
    }

    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('POST /v1/auth/login rejects a wrong password with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'WrongPass123!' })
      .expect(401);

    wrongPasswordMessage = response.body.message as string | string[];
    wrongPasswordBody = response.body as Record<string, unknown>;

    expect(response.body).toMatchObject({
      statusCode: 401,
      path: '/v1/auth/login',
    });
    expect(response.body.timestamp).toBeDefined();
    expect(wrongPasswordMessage).toBe('Invalid email or password');
  });

  it('POST /v1/auth/login rejects an unknown e-mail with the same body', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: missingEmail, password })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: wrongPasswordBody.statusCode,
      error: wrongPasswordBody.error,
      message: wrongPasswordBody.message,
      path: wrongPasswordBody.path,
    });
    expect(response.body.message).toBe(wrongPasswordMessage);
  });

  it.each([
    {
      label: 'a missing e-mail',
      payload: { password },
      field: 'email',
    },
    {
      label: 'a missing password',
      payload: { email },
      field: 'password',
    },
    {
      label: 'a password with 129 characters',
      payload: { email, password: 'a'.repeat(129) },
      field: 'password',
    },
  ])(
    'POST /v1/auth/login rejects $label with 400',
    async ({ payload, field }) => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(payload)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.path).toBe('/v1/auth/login');
      expect(response.body.timestamp).toBeDefined();
      expect(JSON.stringify(response.body.message)).toContain(field);
    },
  );

  it('GET /v1/auth/me returns the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({ name, email });
    expect(response.body.id).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
    expect(Object.keys(response.body).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ]);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password_hash');
  });

  it('GET /v1/auth/me rejects a request without a token with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid or missing access token',
      path: '/v1/auth/me',
    });
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /v1/auth/me rejects an invalid token with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.path).toBe('/v1/auth/me');
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /v1/auth/me rejects a token signed with another secret with 401', async () => {
    const token = app.get(JwtService).sign(
      { sub: randomUUID(), email: 'ghost@example.com' },
      { secret: 'another-secret-with-at-least-32-chars' },
    );

    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.path).toBe('/v1/auth/me');
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /v1/auth/me rejects an expired token with 401', async () => {
    const token = app.get(JwtService).sign(
      { sub: randomUUID(), email: 'ghost@example.com' },
      { expiresIn: '-1s' },
    );

    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.path).toBe('/v1/auth/me');
    expect(response.body.timestamp).toBeDefined();
  });

  it('GET /v1/auth/me rejects a token whose subject does not exist with 401', async () => {
    const token = app.get(JwtService).sign({
      sub: randomUUID(),
      email: 'ghost@example.com',
    });

    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body.path).toBe('/v1/auth/me');
    expect(response.body.timestamp).toBeDefined();
  });

  it('rejects a soft-deleted user on /me and login with 401', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name, email: deletedEmail, password })
      .expect(201);

    const token = registerResponse.body.accessToken as string;
    const dataSource = app.get(DataSource);

    await dataSource.query(
      'UPDATE users SET deleted_at = NOW(6) WHERE email = ?',
      [deletedEmail],
    );

    const meResponse = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(meResponse.body.statusCode).toBe(401);
    expect(meResponse.body.message).toBe(
      'Authenticated user no longer exists',
    );

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: deletedEmail, password })
      .expect(401);
  });
});
