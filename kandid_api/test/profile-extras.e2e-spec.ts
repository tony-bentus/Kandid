import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import {
  authorization,
  createTestProfile,
  deleteUsersByEmailPrefix,
  registerTestUser,
  type TestUser,
} from './helpers/auth.js';
import { errorMentions, expectApiError } from './helpers/response.js';

const EMAIL_PREFIX = 'extras-e2e';

interface Education {
  id: string;
  profileId: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  [key: string]: unknown;
}

interface Certification {
  id: string;
  profileId: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string | null;
  [key: string]: unknown;
}

interface Language {
  id: string;
  profileId: string;
  name: string;
  proficiency: string;
  [key: string]: unknown;
}

function educationPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    institution: 'Universidade de São Paulo',
    degree: 'Bacharelado',
    fieldOfStudy: 'Ciência da Computação',
    startDate: '2018-02-01',
    endDate: '2022-12-15',
    isCurrent: false,
    ...overrides,
  };
}

function certificationPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: 'AWS Certified Solutions Architect',
    issuer: 'Amazon Web Services',
    issueDate: '2024-03-10',
    expiryDate: '2027-03-10',
    ...overrides,
  };
}

describe('KAN-16 — Formação, certificações e idiomas (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  let otherUser: TestUser;
  let noProfileUser: TestUser;
  let orderUser: TestUser;
  let education: Education;
  let certification: Certification;
  let language: Language;

  async function createEducation(
    token: string,
    body: Record<string, unknown> = {},
  ): Promise<Education> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/educations')
      .set('Authorization', authorization(token))
      .send(educationPayload(body))
      .expect(201);

    return response.body as Education;
  }

  async function createCertification(
    token: string,
    body: Record<string, unknown> = {},
  ): Promise<Certification> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/certifications')
      .set('Authorization', authorization(token))
      .send(certificationPayload(body))
      .expect(201);

    return response.body as Certification;
  }

  async function createLanguage(
    token: string,
    body: Record<string, unknown>,
  ): Promise<Language> {
    const response = await request(app.getHttpServer())
      .post('/v1/me/languages')
      .set('Authorization', authorization(token))
      .send(body)
      .expect(201);

    return response.body as Language;
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
    await createTestProfile(app, user.token, { headline: 'Extras QA' });
    await createTestProfile(app, otherUser.token, { headline: 'Other Extras' });
    await createTestProfile(app, orderUser.token);

    education = await createEducation(user.token);
    certification = await createCertification(user.token);
    language = await createLanguage(user.token, {
      name: 'Inglês',
      proficiency: 'FLUENT',
    });
  });

  afterAll(async () => {
    try {
      await deleteUsersByEmailPrefix(app, EMAIL_PREFIX);
    } finally {
      await app.close();
    }
  });

  describe('formações (KAN-16)', () => {
    it('POST /v1/me/educations cria e GET /v1/me/educations lista', async () => {
      const created = await createEducation(user.token, {
        institution: 'UNICAMP',
        degree: 'Mestrado',
        fieldOfStudy: 'Engenharia de Software',
      });

      expect(created.id).toBeDefined();
      expect(created.profileId).toBe(education.profileId);
      expect(created.institution).toBe('UNICAMP');
      expect(created.startDate).toBe('2018-02-01');

      const list = await request(app.getHttpServer())
        .get('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((list.body as Education[]).map((item) => item.id)).toContain(
        created.id,
      );
    });

    it('GET /v1/me/educations/:id devolve a formação persistida', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((response.body as Education).id).toBe(education.id);
      expect((response.body as Education).institution).toBe(
        'Universidade de São Paulo',
      );
    });

    it('PATCH /v1/me/educations/:id atualiza parcialmente', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(user.token))
        .send({ degree: 'Doutorado' })
        .expect(200);

      expect((response.body as Education).degree).toBe('Doutorado');
      expect((response.body as Education).institution).toBe(
        'Universidade de São Paulo',
      );
    });

    it('POST rejeita isCurrent=true com endDate preenchida', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .send(educationPayload({ isCurrent: true, endDate: '2022-12-15' }))
        .expect(400);

      expectApiError(response, 400, '/v1/me/educations');
    });

    it('POST rejeita isCurrent=false sem endDate com mensagem sobre endDate', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .send(educationPayload({ endDate: undefined, isCurrent: false }))
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/educations');
      expect(errorMentions(body, 'endDate')).toBe(true);
    });

    it('POST rejeita endDate anterior a startDate', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .send(educationPayload({ endDate: '2017-01-01' }))
        .expect(400);

      expectApiError(response, 400, '/v1/me/educations');
    });

    it('POST rejeita startDate com hora', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .send(educationPayload({ startDate: '2018-02-01T00:00:00Z' }))
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/educations');
      expect(errorMentions(body, 'startDate')).toBe(true);
    });

    it('PATCH parcial com endDate anterior a startDate responde 400', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(user.token))
        .send({ endDate: '2000-01-01' })
        .expect(400);

      expectApiError(response, 400, `/v1/me/educations/${education.id}`);
    });

    it('PATCH parcial com data em formato inválido responde 400', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(user.token))
        .send({ startDate: '01-02-2018' })
        .expect(400);

      const body = expectApiError(
        response,
        400,
        `/v1/me/educations/${education.id}`,
      );
      expect(errorMentions(body, 'startDate')).toBe(true);
    });

    it.each(['profile_id', 'user_id', 'profileId'])(
      'POST rejeita campo desconhecido %s com 400',
      async (field) => {
        const response = await request(app.getHttpServer())
          .post('/v1/me/educations')
          .set('Authorization', authorization(user.token))
          .send(educationPayload({ [field]: user.userId }))
          .expect(400);

        const body = expectApiError(response, 400, '/v1/me/educations');
        expect(errorMentions(body, field)).toBe(true);
      },
    );

    it('GET/PATCH/DELETE de formação de outro usuário respondem 404', async () => {
      await request(app.getHttpServer())
        .get(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(otherUser.token))
        .send({ degree: 'Invasor' })
        .expect(404);

      const del = await request(app.getHttpServer())
        .delete(`/v1/me/educations/${education.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      expectApiError(del, 404, `/v1/me/educations/${education.id}`);
    });

    it('GET/POST /v1/me/educations sem perfil respondem 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/me/educations')
        .set('Authorization', authorization(noProfileUser.token))
        .expect(404);

      const post = await request(app.getHttpServer())
        .post('/v1/me/educations')
        .set('Authorization', authorization(noProfileUser.token))
        .send(educationPayload())
        .expect(404);

      expectApiError(post, 404, '/v1/me/educations');
    });

    it('DELETE /v1/me/educations/:id responde 204 e remove da listagem', async () => {
      const disposable = await createEducation(user.token, {
        institution: 'Instituto Tecnológico',
      });

      const response = await request(app.getHttpServer())
        .delete(`/v1/me/educations/${disposable.id}`)
        .set('Authorization', authorization(user.token))
        .expect(204);

      expect(response.text).toBe('');

      const list = await request(app.getHttpServer())
        .get('/v1/me/educations')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((list.body as Education[]).map((item) => item.id)).not.toContain(
        disposable.id,
      );
    });

    it('GET /v1/me/educations ordena por startDate descendente', async () => {
      const oldest = await createEducation(orderUser.token, {
        startDate: '2010-01-01',
      });
      const newest = await createEducation(orderUser.token, {
        startDate: '2020-01-01',
      });
      const middle = await createEducation(orderUser.token, {
        startDate: '2015-01-01',
      });

      const response = await request(app.getHttpServer())
        .get('/v1/me/educations')
        .set('Authorization', authorization(orderUser.token))
        .expect(200);

      expect((response.body as Education[]).map((item) => item.id)).toEqual([
        newest.id,
        middle.id,
        oldest.id,
      ]);
    });
  });

  describe('certificações (KAN-16)', () => {
    it('POST /v1/me/certifications cria e GET lista', async () => {
      const created = await createCertification(user.token, {
        name: 'CKA',
        issuer: 'CNCF',
        issueDate: '2025-01-15',
      });

      expect(created.id).toBeDefined();
      expect(created.profileId).toBe(certification.profileId);
      expect(created.name).toBe('CKA');
      expect(created.issueDate).toBe('2025-01-15');

      const list = await request(app.getHttpServer())
        .get('/v1/me/certifications')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((list.body as Certification[]).map((item) => item.id)).toContain(
        created.id,
      );
    });

    it('GET /v1/me/certifications/:id devolve a certificação persistida', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((response.body as Certification).id).toBe(certification.id);
      expect((response.body as Certification).issuer).toBe(
        'Amazon Web Services',
      );
    });

    it('PATCH /v1/me/certifications/:id atualiza parcialmente', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(user.token))
        .send({ credentialId: 'ABC-123' })
        .expect(200);

      expect((response.body as Certification).credentialId).toBe('ABC-123');
      expect((response.body as Certification).name).toBe(certification.name);
    });

    it('POST rejeita expiryDate anterior a issueDate', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/certifications')
        .set('Authorization', authorization(user.token))
        .send(certificationPayload({
          issueDate: '2024-03-10',
          expiryDate: '2024-03-09',
        }))
        .expect(400);

      expectApiError(response, 400, '/v1/me/certifications');
    });

    it('PATCH parcial rejeita expiryDate anterior a issueDate', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(user.token))
        .send({ expiryDate: '2020-01-01' })
        .expect(400);

      expectApiError(response, 400, `/v1/me/certifications/${certification.id}`);
    });

    it('POST aceita certificação já expirada (histórico preservado)', async () => {
      const created = await createCertification(user.token, {
        name: 'Certificado antigo',
        issueDate: '2019-01-10',
        expiryDate: '2020-01-10',
      });

      expect(created.issueDate).toBe('2019-01-10');
      expect(created.expiryDate).toBe('2020-01-10');
    });

    it('POST rejeita credentialUrl sem protocolo HTTP(S)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/certifications')
        .set('Authorization', authorization(user.token))
        .send(certificationPayload({ credentialUrl: 'credly.com/badge/1' }))
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/certifications');
      expect(errorMentions(body, 'credentialUrl')).toBe(true);
    });

    it('POST rejeita issueDate com hora', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/certifications')
        .set('Authorization', authorization(user.token))
        .send(certificationPayload({ issueDate: '2024-03-10T12:00:00Z' }))
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/certifications');
      expect(errorMentions(body, 'issueDate')).toBe(true);
    });

    it.each(['profile_id', 'user_id', 'profileId'])(
      'POST rejeita campo desconhecido %s com 400',
      async (field) => {
        const response = await request(app.getHttpServer())
          .post('/v1/me/certifications')
          .set('Authorization', authorization(user.token))
          .send(certificationPayload({ [field]: user.userId }))
          .expect(400);

        const body = expectApiError(response, 400, '/v1/me/certifications');
        expect(errorMentions(body, field)).toBe(true);
      },
    );

    it('GET/PATCH/DELETE de certificação de outro usuário respondem 404', async () => {
      await request(app.getHttpServer())
        .get(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(otherUser.token))
        .send({ name: 'Invasor' })
        .expect(404);

      const del = await request(app.getHttpServer())
        .delete(`/v1/me/certifications/${certification.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      expectApiError(del, 404, `/v1/me/certifications/${certification.id}`);
    });

    it('GET/POST /v1/me/certifications sem perfil respondem 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/me/certifications')
        .set('Authorization', authorization(noProfileUser.token))
        .expect(404);

      const post = await request(app.getHttpServer())
        .post('/v1/me/certifications')
        .set('Authorization', authorization(noProfileUser.token))
        .send(certificationPayload())
        .expect(404);

      expectApiError(post, 404, '/v1/me/certifications');
    });

    it('DELETE /v1/me/certifications/:id responde 204 e remove da listagem', async () => {
      const disposable = await createCertification(user.token, {
        name: 'Temporária',
      });

      const response = await request(app.getHttpServer())
        .delete(`/v1/me/certifications/${disposable.id}`)
        .set('Authorization', authorization(user.token))
        .expect(204);

      expect(response.text).toBe('');

      const list = await request(app.getHttpServer())
        .get('/v1/me/certifications')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((list.body as Certification[]).map((item) => item.id)).not.toContain(
        disposable.id,
      );
    });

    it('GET /v1/me/certifications ordena por issueDate descendente', async () => {
      const oldest = await createCertification(orderUser.token, {
        name: 'Antiga',
        issueDate: '2019-01-01',
      });
      const newest = await createCertification(orderUser.token, {
        name: 'Recente',
        issueDate: '2025-01-01',
      });
      const middle = await createCertification(orderUser.token, {
        name: 'Intermediária',
        issueDate: '2022-01-01',
      });

      const response = await request(app.getHttpServer())
        .get('/v1/me/certifications')
        .set('Authorization', authorization(orderUser.token))
        .expect(200);

      expect((response.body as Certification[]).map((item) => item.id)).toEqual([
        newest.id,
        middle.id,
        oldest.id,
      ]);
    });
  });

  describe('idiomas (KAN-16)', () => {
    it('POST /v1/me/languages cria com nome normalizado (trim)', async () => {
      const created = await createLanguage(user.token, {
        name: '  Espanhol  ',
        proficiency: 'INTERMEDIATE',
      });

      expect(created.id).toBeDefined();
      expect(created.profileId).toBe(language.profileId);
      expect(created.name).toBe('Espanhol');
      expect(created.proficiency).toBe('INTERMEDIATE');
    });

    it('POST duplica idioma com caixa/acento diferentes responde 409', async () => {
      await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .send({ name: 'ingles', proficiency: 'BASIC' })
        .expect(409);

      const second = await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .send({ name: '  INGLES  ', proficiency: 'BASIC' })
        .expect(409);

      expectApiError(second, 409, '/v1/me/languages');
    });

    it('PATCH para nome já cadastrado no perfil responde 409', async () => {
      const disposable = await createLanguage(user.token, {
        name: 'Alemão',
        proficiency: 'BASIC',
      });

      const response = await request(app.getHttpServer())
        .patch(`/v1/me/languages/${disposable.id}`)
        .set('Authorization', authorization(user.token))
        .send({ name: 'ingles' })
        .expect(409);

      expectApiError(response, 409, `/v1/me/languages/${disposable.id}`);
    });

    it('POST rejeita proficiency fora do enum com 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .send({ name: 'Italiano', proficiency: 'GURU' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/languages');
      expect(errorMentions(body, 'proficiency')).toBe(true);
    });

    it('PATCH rejeita proficiency fora do enum com 400', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(user.token))
        .send({ proficiency: 'GURU' })
        .expect(400);

      const body = expectApiError(
        response,
        400,
        `/v1/me/languages/${language.id}`,
      );
      expect(errorMentions(body, 'proficiency')).toBe(true);
    });

    it('POST rejeita nome acima de 60 caracteres com 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .send({ name: 'a'.repeat(61), proficiency: 'BASIC' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/languages');
      expect(errorMentions(body, 'name')).toBe(true);
    });

    it('POST rejeita campo desconhecido profileId com 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .send({ name: 'Holandês', proficiency: 'BASIC', profileId: 'hack' })
        .expect(400);

      const body = expectApiError(response, 400, '/v1/me/languages');
      expect(errorMentions(body, 'profileId')).toBe(true);
    });

    it('GET /v1/me/languages/:id devolve o idioma persistido', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((response.body as Language).name).toBe('Inglês');
      expect((response.body as Language).proficiency).toBe('FLUENT');
    });

    it('PATCH /v1/me/languages/:id atualiza parcialmente', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(user.token))
        .send({ proficiency: 'NATIVE' })
        .expect(200);

      expect((response.body as Language).proficiency).toBe('NATIVE');
      expect((response.body as Language).name).toBe('Inglês');
    });

    it('GET/PATCH/DELETE de idioma de outro usuário respondem 404', async () => {
      await request(app.getHttpServer())
        .get(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(otherUser.token))
        .send({ name: 'Invasor' })
        .expect(404);

      const del = await request(app.getHttpServer())
        .delete(`/v1/me/languages/${language.id}`)
        .set('Authorization', authorization(otherUser.token))
        .expect(404);

      expectApiError(del, 404, `/v1/me/languages/${language.id}`);
    });

    it('GET/POST /v1/me/languages sem perfil respondem 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/me/languages')
        .set('Authorization', authorization(noProfileUser.token))
        .expect(404);

      const post = await request(app.getHttpServer())
        .post('/v1/me/languages')
        .set('Authorization', authorization(noProfileUser.token))
        .send({ name: 'Francês', proficiency: 'BASIC' })
        .expect(404);

      expectApiError(post, 404, '/v1/me/languages');
    });

    it('DELETE /v1/me/languages/:id responde 204 e remove da listagem', async () => {
      const disposable = await createLanguage(user.token, {
        name: 'Mandarim',
        proficiency: 'BASIC',
      });

      const response = await request(app.getHttpServer())
        .delete(`/v1/me/languages/${disposable.id}`)
        .set('Authorization', authorization(user.token))
        .expect(204);

      expect(response.text).toBe('');

      const list = await request(app.getHttpServer())
        .get('/v1/me/languages')
        .set('Authorization', authorization(user.token))
        .expect(200);

      expect((list.body as Language[]).map((item) => item.id)).not.toContain(
        disposable.id,
      );
    });

    it('GET /v1/me/languages ordena por name ascendente', async () => {
      await createLanguage(orderUser.token, {
        name: 'Inglês',
        proficiency: 'FLUENT',
      });
      await createLanguage(orderUser.token, {
        name: 'Francês',
        proficiency: 'BASIC',
      });
      const first = await createLanguage(orderUser.token, {
        name: 'Espanhol',
        proficiency: 'INTERMEDIATE',
      });

      const response = await request(app.getHttpServer())
        .get('/v1/me/languages')
        .set('Authorization', authorization(orderUser.token))
        .expect(200);

      const names = (response.body as Language[]).map((item) => item.name);

      expect(names).toEqual(['Espanhol', 'Francês', 'Inglês']);
      expect((response.body as Language[])[0]?.id).toBe(first.id);
    });
  });

  describe('transversal (KAN-13 a KAN-16)', () => {
    it.each([
      {
        label: 'GET educations',
        path: '/v1/me/educations',
        run: async () =>
          request(app.getHttpServer()).get('/v1/me/educations'),
      },
      {
        label: 'POST educations',
        path: '/v1/me/educations',
        run: async () =>
          request(app.getHttpServer())
            .post('/v1/me/educations')
            .send(educationPayload()),
      },
      {
        label: 'GET education :id',
        path: () => `/v1/me/educations/${education.id}`,
        run: async () =>
          request(app.getHttpServer()).get(`/v1/me/educations/${education.id}`),
      },
      {
        label: 'PATCH education :id',
        path: () => `/v1/me/educations/${education.id}`,
        run: async () =>
          request(app.getHttpServer())
            .patch(`/v1/me/educations/${education.id}`)
            .send({ degree: 'Mestrado' }),
      },
      {
        label: 'DELETE education :id',
        path: () => `/v1/me/educations/${education.id}`,
        run: async () =>
          request(app.getHttpServer()).delete(`/v1/me/educations/${education.id}`),
      },
      {
        label: 'GET certifications',
        path: '/v1/me/certifications',
        run: async () =>
          request(app.getHttpServer()).get('/v1/me/certifications'),
      },
      {
        label: 'POST certifications',
        path: '/v1/me/certifications',
        run: async () =>
          request(app.getHttpServer())
            .post('/v1/me/certifications')
            .send(certificationPayload()),
      },
      {
        label: 'GET certification :id',
        path: () => `/v1/me/certifications/${certification.id}`,
        run: async () =>
          request(app.getHttpServer()).get(
            `/v1/me/certifications/${certification.id}`,
          ),
      },
      {
        label: 'PATCH certification :id',
        path: () => `/v1/me/certifications/${certification.id}`,
        run: async () =>
          request(app.getHttpServer())
            .patch(`/v1/me/certifications/${certification.id}`)
            .send({ issuer: 'Outra' }),
      },
      {
        label: 'DELETE certification :id',
        path: () => `/v1/me/certifications/${certification.id}`,
        run: async () =>
          request(app.getHttpServer()).delete(
            `/v1/me/certifications/${certification.id}`,
          ),
      },
      {
        label: 'GET languages',
        path: '/v1/me/languages',
        run: async () => request(app.getHttpServer()).get('/v1/me/languages'),
      },
      {
        label: 'POST languages',
        path: '/v1/me/languages',
        run: async () =>
          request(app.getHttpServer())
            .post('/v1/me/languages')
            .send({ name: 'Italiano', proficiency: 'BASIC' }),
      },
      {
        label: 'GET language :id',
        path: () => `/v1/me/languages/${language.id}`,
        run: async () =>
          request(app.getHttpServer()).get(`/v1/me/languages/${language.id}`),
      },
      {
        label: 'PATCH language :id',
        path: () => `/v1/me/languages/${language.id}`,
        run: async () =>
          request(app.getHttpServer())
            .patch(`/v1/me/languages/${language.id}`)
            .send({ proficiency: 'BASIC' }),
      },
      {
        label: 'DELETE language :id',
        path: () => `/v1/me/languages/${language.id}`,
        run: async () =>
          request(app.getHttpServer()).delete(`/v1/me/languages/${language.id}`),
      },
    ])('$label sem token responde 401', async ({ path, run }) => {
      const raw = await run();
      const expectedPath = typeof path === 'function' ? path() : path;

      expectApiError({ status: raw.status, body: raw.body }, 401, expectedPath);
    });

    it('token inválido responde 401 em rota de domínio', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/me/educations')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      const body = expectApiError(response, 401, '/v1/me/educations');
      expect(body.message).toBe('Invalid or missing access token');
    });

    it('dois usuários autenticados veem apenas os próprios registros', async () => {
      const ownEducation = await createEducation(otherUser.token, {
        institution: 'USP',
      });
      const ownCertification = await createCertification(otherUser.token, {
        name: 'Certificação própria',
      });
      const ownLanguage = await createLanguage(otherUser.token, {
        name: 'Japonês',
        proficiency: 'BASIC',
      });

      const [firstEducation, secondEducation] = await Promise.all([
        request(app.getHttpServer())
          .get('/v1/me/educations')
          .set('Authorization', authorization(user.token))
          .expect(200),
        request(app.getHttpServer())
          .get('/v1/me/educations')
          .set('Authorization', authorization(otherUser.token))
          .expect(200),
      ]);
      const [firstCertification, secondCertification] = await Promise.all([
        request(app.getHttpServer())
          .get('/v1/me/certifications')
          .set('Authorization', authorization(user.token))
          .expect(200),
        request(app.getHttpServer())
          .get('/v1/me/certifications')
          .set('Authorization', authorization(otherUser.token))
          .expect(200),
      ]);
      const [firstLanguage, secondLanguage] = await Promise.all([
        request(app.getHttpServer())
          .get('/v1/me/languages')
          .set('Authorization', authorization(user.token))
          .expect(200),
        request(app.getHttpServer())
          .get('/v1/me/languages')
          .set('Authorization', authorization(otherUser.token))
          .expect(200),
      ]);

      const firstEducationIds = (firstEducation.body as Education[]).map(
        (item) => item.id,
      );
      const secondEducationIds = (secondEducation.body as Education[]).map(
        (item) => item.id,
      );
      const firstCertificationIds = (
        firstCertification.body as Certification[]
      ).map((item) => item.id);
      const secondCertificationIds = (
        secondCertification.body as Certification[]
      ).map((item) => item.id);
      const firstLanguageIds = (firstLanguage.body as Language[]).map(
        (item) => item.id,
      );
      const secondLanguageIds = (secondLanguage.body as Language[]).map(
        (item) => item.id,
      );

      expect(firstEducationIds).toContain(education.id);
      expect(firstEducationIds).not.toContain(ownEducation.id);
      expect(secondEducationIds).toEqual([ownEducation.id]);

      expect(firstCertificationIds).toContain(certification.id);
      expect(firstCertificationIds).not.toContain(ownCertification.id);
      expect(secondCertificationIds).toEqual([ownCertification.id]);

      expect(firstLanguageIds).toContain(language.id);
      expect(firstLanguageIds).not.toContain(ownLanguage.id);
      expect(secondLanguageIds).toEqual([ownLanguage.id]);
    });
  });
});
