import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';

/** Senha forte o suficiente para o registro e estável entre suítes. */
export const TEST_PASSWORD = 'S3curePass!';

export interface TestUser {
  token: string;
  userId: string;
  email: string;
}

/** Recorte da resposta de perfil usado pelos testes; chaves extras são permitidas. */
export interface ProfileResponse {
  id: string;
  userId: string;
  [key: string]: unknown;
}

export function authorization(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Registra um usuário isolado por suíte. O prefixo do e-mail deve ser estável
 * por arquivo para que o `afterAll` limpe apenas os usuários da própria suíte.
 */
export async function registerTestUser(
  app: INestApplication<App>,
  emailPrefix: string,
  name = 'QA E2E',
): Promise<TestUser> {
  const email = `${emailPrefix}-${randomUUID()}@example.com`;
  const response = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({ name, email, password: TEST_PASSWORD })
    .expect(201);

  const body = response.body as {
    accessToken: string;
    user: { id: string; email: string };
  };

  return {
    token: body.accessToken,
    userId: body.user.id,
    email: body.user.email,
  };
}

/** Cria (ou atualiza) o perfil via PATCH, única rota de criação do perfil. */
export async function createTestProfile(
  app: INestApplication<App>,
  token: string,
  payload: Record<string, unknown> = { headline: 'QA Profile' },
): Promise<ProfileResponse> {
  const response = await request(app.getHttpServer())
    .patch('/v1/me/profile')
    .set('Authorization', authorization(token))
    .send(payload)
    .expect(200);

  return response.body as ProfileResponse;
}

/** Remove somente os usuários desta suíte; as cascatas removem os filhos. */
export async function deleteUsersByEmailPrefix(
  app: INestApplication<App>,
  emailPrefix: string,
): Promise<void> {
  await app.get(DataSource).query('DELETE FROM users WHERE email LIKE ?', [
    `${emailPrefix}-%`,
  ]);
}
