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

const EMAIL_PREFIX = 'resumes-export-e2e';
const NOT_A_UUID = 'not-a-uuid';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

const EXPECTED_SECTION_TITLES = [
  'Resumo',
  'Habilidades',
  'Experiência Profissional',
  'Formação',
  'Certificações',
  'Idiomas',
] as const;

interface SnapshotLike {
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
  skills: unknown[];
  experiences: unknown[];
  education: unknown[];
  certifications: unknown[];
  languages: unknown[];
  projects: unknown[];
}

interface VersionBody {
  id: string;
  resumeId: string;
  version: number;
  atsScore: number | null;
  contentSnapshot: SnapshotLike;
}

interface ExportJsonBody {
  resumeId: string;
  version: number;
  atsScore: number | null;
  contentSnapshot: SnapshotLike;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('KAN-50/51 — Export JSON e HTML de versões (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let user: TestUser;
  let otherUser: TestUser;
  let xssUser: TestUser;
  let emptyUser: TestUser;

  let mainVersion: VersionBody;
  let otherVersion: VersionBody;
  let xssVersion: VersionBody;
  let emptyVersion: VersionBody;
  let ownResumeId: string;

  async function newUser(name = 'Marina Exportadora'): Promise<TestUser> {
    return registerTestUser(app, EMAIL_PREFIX, name);
  }

  async function createResume(token: string, name: string, targetRole: string) {
    const response = await request(app.getHttpServer())
      .post('/v1/resumes')
      .set('Authorization', authorization(token))
      .send({ name, targetRole })
      .expect(201);

    return response.body as { id: string };
  }

  async function createVersion(token: string, resumeId: string) {
    const response = await request(app.getHttpServer())
      .post(`/v1/resumes/${resumeId}/versions`)
      .set('Authorization', authorization(token))
      .expect(201);

    return response.body as VersionBody;
  }

  async function createJob(token: string): Promise<{ id: string }> {
    const company = await request(app.getHttpServer())
      .post('/v1/companies')
      .set('Authorization', authorization(token))
      .send({ name: `Empresa ${randomUUID().slice(0, 8)}`, kind: 'CLIENT' })
      .expect(201);
    const companyId = (company.body as { id: string }).id;

    const job = await request(app.getHttpServer())
      .post('/v1/jobs')
      .set('Authorization', authorization(token))
      .send({
        companyId,
        title: 'Desenvolvedor Backend Sênior',
        description:
          'Node.js, TypeScript e Kubernetes. Experiência de 5+ anos em backend.',
        seniority: 'SENIOR',
        workModel: 'REMOTE',
        contractType: 'CLT',
        source: 'LINKEDIN',
        salaryPeriod: 'MONTH',
      })
      .expect(201);

    return job.body as { id: string };
  }

  async function analyze(
    token: string,
    versionId: string,
    jobId: string,
  ): Promise<{ id: string; score: number }> {
    const response = await request(app.getHttpServer())
      .post(`/v1/resume-versions/${versionId}/analyze`)
      .set('Authorization', authorization(token))
      .send({ jobId })
      .expect(201);

    return response.body as { id: string; score: number };
  }

  async function dumpExportTables(versionId: string): Promise<string> {
    const versions = await dataSource.query(
      `SELECT id, resume_id, version, ats_score, content_snapshot, created_at
         FROM resume_versions WHERE id = ? ORDER BY id`,
      [versionId],
    );
    const analyses = await dataSource.query(
      'SELECT * FROM ats_analyses WHERE resume_version_id = ? ORDER BY id',
      [versionId],
    );

    return JSON.stringify({ versions, analyses });
  }

  async function cleanup(): Promise<void> {
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
      `DELETE v FROM resume_versions v
        JOIN resumes r ON r.id = v.resume_id
        JOIN users u ON u.id = r.user_id
        WHERE u.email LIKE ?`,
      [like],
    );
    await dataSource.query(
      `DELETE j FROM jobs j JOIN users u ON u.id = j.user_id WHERE u.email LIKE ?`,
      [like],
    );
    await dataSource.query(
      `DELETE c FROM companies c JOIN users u ON u.id = c.user_id WHERE u.email LIKE ?`,
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
    dataSource = app.get(DataSource);

    await ensureSkills(dataSource);

    // Usuário principal com snapshot rico (todas as seções preenchidas).
    user = await newUser();
    await createTestProfile(app, user.token, {
      headline: 'Backend Developer',
      summary: 'Resumo com <tags>, & e aspas "duplas" e acentuação: São Paulo.',
      phone: '+55 11 99999-0000',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
      linkedinUrl: 'https://linkedin.com/in/marina',
      githubUrl: 'https://github.com/marina',
      portfolioUrl: 'https://marina.example.com',
      desiredRole: 'Desenvolvedor Backend Sênior',
      desiredSeniority: 'SENIOR',
    });
    const skillRows = (await dataSource.query(
      'SELECT id FROM skills WHERE name = ? LIMIT 1',
      ['Node.js'],
    )) as Array<{ id: string }>;
    expect(skillRows[0]?.id).toBeTruthy();
    await request(app.getHttpServer())
      .post('/v1/me/skills')
      .set('Authorization', authorization(user.token))
      .send({ skillId: skillRows[0]?.id, level: 'ADVANCED', yearsExperience: 5 })
      .expect(201);
    const experience = await request(app.getHttpServer())
      .post('/v1/me/experiences')
      .set('Authorization', authorization(user.token))
      .send({
        companyName: 'Acme',
        role: 'Backend Developer',
        employmentType: 'CLT',
        workModel: 'REMOTE',
        location: 'Remoto',
        startDate: '2021-03-01',
        isCurrent: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/me/experiences/${(experience.body as { id: string }).id}/bullets`)
      .set('Authorization', authorization(user.token))
      .send({ text: 'Reduzi a latência da API em 40%.' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/me/educations')
      .set('Authorization', authorization(user.token))
      .send({
        institution: 'Universidade de São Paulo',
        degree: 'Bacharelado',
        fieldOfStudy: 'Ciência da Computação',
        startDate: '2015-02-01',
        endDate: '2019-12-15',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/me/certifications')
      .set('Authorization', authorization(user.token))
      .send({
        name: 'AWS Certified Developer',
        issuer: 'Amazon Web Services',
        issueDate: '2024-03-10',
        expiryDate: '2027-03-10',
        credentialUrl: 'https://www.credly.com/badges/exemplo',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/me/languages')
      .set('Authorization', authorization(user.token))
      .send({ name: 'Inglês', proficiency: 'ADVANCED' })
      .expect(201);

    const mainResume = await createResume(
      user.token,
      'Export principal',
      'Desenvolvedor Backend Sênior',
    );
    ownResumeId = mainResume.id;
    mainVersion = await createVersion(user.token, mainResume.id);

    // Usuário alheio com versão para testar isolamento.
    otherUser = await newUser('Outro Candidato');
    await createTestProfile(app, otherUser.token, {
      headline: 'Analista de Dados',
      desiredRole: 'Analista de Dados',
    });
    const otherResume = await createResume(
      otherUser.token,
      'Export alheio',
      'Analista de Dados',
    );
    otherVersion = await createVersion(otherUser.token, otherResume.id);

    // Usuário com perfil mínimo: todas as seções opcionais vazias.
    emptyUser = await newUser('Sem Secoes');
    await createTestProfile(app, emptyUser.token, { headline: 'Perfil mínimo' });
    const emptyResume = await createResume(
      emptyUser.token,
      'Export vazio',
      'Cargo',
    );
    emptyVersion = await createVersion(emptyUser.token, emptyResume.id);

    // Usuário com payload hostil, cujo snapshot é ajustado via fixture SQL.
    xssUser = await newUser('<script>alert(1)</script>');
    await createTestProfile(app, xssUser.token, {
      headline: '"><img onerror=alert(1)> & Dev',
      summary: '<script>alert(1)</script> & \'aspas\'',
      desiredRole: 'Engenheiro & <Segurança>',
    });
    const xssResume = await createResume(xssUser.token, 'Export XSS', 'Dev');
    xssVersion = await createVersion(xssUser.token, xssResume.id);
    await dataSource.query(
      `UPDATE resume_versions
          SET content_snapshot = JSON_SET(
            content_snapshot,
            '$.candidate.links.linkedin', ?,
            '$.candidate.links.github', ?,
            '$.candidate.links.portfolio', ?,
            '$.projects', JSON_ARRAY(?)
          )
        WHERE id = ?`,
      [
        'javascript:alert(1)',
        'https://github.com/qa?x=1&y="<script>"',
        'data:text/html,<script>alert(2)</script>',
        '<script>PROJECTS_LEAK</script>',
        xssVersion.id,
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

  // ------------------------------------------------------------ Autenticação

  it.each([
    { label: 'json', query: 'format=json' },
    { label: 'html', query: 'format=html' },
    { label: 'sem format', query: '' },
    { label: 'format inválido', query: 'format=pdf' },
    { label: 'query extra', query: 'download=1' },
  ])('GET export?$query sem token responde 401 ($label)', async ({ query }) => {
    const suffix = query.length > 0 ? `?${query}` : '';
    const path = `/v1/resume-versions/${mainVersion.id}/export${suffix}`;

    const response = await request(app.getHttpServer()).get(path);

    expectApiError(response, 401, path);
  });

  // --------------------------------------------------------- Validação query

  it.each([
    { label: 'ausente', query: '', term: 'format' },
    { label: 'vazio', query: 'format=', term: 'format' },
    { label: 'inválido', query: 'format=pdf', term: 'format' },
    { label: 'caixa alta', query: 'format=JSON', term: 'format' },
    { label: 'caixa mista', query: 'format=Html', term: 'format' },
    {
      label: 'repetido',
      query: 'format=json&format=html',
      term: 'format',
    },
    {
      label: 'query extra sozinha',
      query: 'download=1',
      term: 'download',
    },
    {
      label: 'query extra com format válido',
      query: 'format=json&pretty=true',
      term: 'pretty',
    },
  ])('GET export com $label responde 400', async ({ query, term }) => {
    const path = `/v1/resume-versions/${mainVersion.id}/export${query.length > 0 ? `?${query}` : ''}`;

    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', authorization(user.token))
      .expect(400);

    const body = expectApiError(response, 400, path);
    expect(errorMentions(body, term)).toBe(true);
    expect(response.body).not.toHaveProperty('contentSnapshot');
  });

  it('GET export com id não-UUID responde 400', async () => {
    const path = `/v1/resume-versions/${NOT_A_UUID}/export?format=json`;
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', authorization(user.token))
      .expect(400);

    expectApiError(response, 400, path);
  });

  // ----------------------------------------------------------- Isolamento 404

  it('GET export de versão alheia ou inexistente responde 404', async () => {
    const foreignPath = `/v1/resume-versions/${otherVersion.id}/export?format=json`;
    const foreign = await request(app.getHttpServer())
      .get(foreignPath)
      .set('Authorization', authorization(user.token))
      .expect(404);
    expectApiError(foreign, 404, foreignPath);

    const missingId = randomUUID();
    const missingPath = `/v1/resume-versions/${missingId}/export?format=html`;
    const missing = await request(app.getHttpServer())
      .get(missingPath)
      .set('Authorization', authorization(user.token))
      .expect(404);
    expectApiError(missing, 404, missingPath);
  });

  it('GET /v1/resumes/:id/export não existe', async () => {
    await request(app.getHttpServer())
      .get(`/v1/resumes/${ownResumeId}/export?format=json`)
      .set('Authorization', authorization(user.token))
      .expect(404);
  });

  // --------------------------------------------------------------- Export JSON

  it('GET export?format=json devolve exatamente resumeId, version, atsScore e contentSnapshot', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=json`)
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^application\/json/);
    const body = response.body as ExportJsonBody;

    expect(Object.keys(body).sort()).toEqual(
      ['atsScore', 'contentSnapshot', 'resumeId', 'version'].sort(),
    );
    expect(body).not.toHaveProperty('data');
    expect(body.resumeId).toBe(mainVersion.resumeId);
    expect(body.version).toBe(mainVersion.version);
    expect(body.contentSnapshot).toEqual(mainVersion.contentSnapshot);
  });

  it('GET export?format=json sem análise devolve atsScore null', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=json`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const body = response.body as ExportJsonBody;

    expect(body.atsScore).toBeNull();

    const rows = (await dataSource.query(
      'SELECT ats_score FROM resume_versions WHERE id = ?',
      [mainVersion.id],
    )) as Array<{ ats_score: number | null }>;
    expect(rows[0]?.ats_score).toBeNull();
  });

  it('GET export?format=json usa a score da análise mais recente, qualquer jobId', async () => {
    const firstJob = await createJob(user.token);
    const secondJob = await createJob(user.token);
    const first = await analyze(user.token, mainVersion.id, firstJob.id);
    await sleep(15);
    const second = await analyze(user.token, mainVersion.id, secondJob.id);

    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=json`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const body = response.body as ExportJsonBody;

    expect(second.id).not.toBe(first.id);
    expect(body.atsScore).toBe(second.score);
    expect(Number.isInteger(body.atsScore)).toBe(true);

    const column = (await dataSource.query(
      'SELECT ats_score FROM resume_versions WHERE id = ?',
      [mainVersion.id],
    )) as Array<{ ats_score: number | null }>;
    expect(column[0]?.ats_score).toBeNull();
  });

  it('GET export?format=json preserva caracteres especiais como dados JSON válidos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=json`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const body = response.body as ExportJsonBody;

    expect(body.contentSnapshot.summary).toContain('<tags>');
    expect(body.contentSnapshot.summary).toContain('&');
    expect(body.contentSnapshot.summary).toContain('"duplas"');
    expect(body.contentSnapshot.summary).toContain('São Paulo');
    expect(body.contentSnapshot.summary).not.toContain('&lt;tags&gt;');
  });

  it('duas chamadas JSON idênticas não alteram resume_versions nem ats_analyses', async () => {
    const url = `/v1/resume-versions/${mainVersion.id}/export?format=json`;
    const before = await dumpExportTables(mainVersion.id);

    const first = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const after = await dumpExportTables(mainVersion.id);

    expect(second.body).toEqual(first.body);
    expect(second.text).toBe(first.text);
    expect(after).toBe(before);
  });

  // --------------------------------------------------------------- Export HTML

  it('GET export?format=html devolve HTML5 pt-BR com conteúdo type e estrutura fixos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=html`)
      .set('Authorization', authorization(user.token))
      .expect(200);

    expect(response.headers['content-type']).toBe(HTML_CONTENT_TYPE);
    const html = response.text;

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<head>');
    expect(html).toContain('<title>');
    expect(html).toContain('<style>');
    expect(html).toContain('<body>');
    expect(html.match(/<main>/g)).toHaveLength(1);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('HTML com snapshot completo traz os seis títulos fixos nesta ordem', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=html`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const html = response.text;

    const positions = EXPECTED_SECTION_TITLES.map(
      (title) => html.indexOf(`<h2>${title}</h2>`),
    );

    positions.forEach((position, index) => {
      expect(position).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        expect(position).toBeGreaterThan(positions[index - 1] ?? -1);
      }
    });
    expect(html).toContain('Marina Exportadora');
    expect(html).toContain('Node.js');
    expect(html).toContain('Acme');
    expect(html).toContain('Universidade de São Paulo');
    expect(html).toContain('AWS Certified Developer');
    expect(html).toContain('Inglês');
  });

  it('HTML omite seções vazias, inclusive seus títulos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${emptyVersion.id}/export?format=html`)
      .set('Authorization', authorization(emptyUser.token))
      .expect(200);
    const html = response.text;

    for (const title of EXPECTED_SECTION_TITLES) {
      expect(html).not.toContain(`<h2>${title}</h2>`);
    }
    expect(html).not.toContain('<section>');
    expect(html).not.toContain('Não informado');
    expect(html).toContain('</main>');
  });

  it('HTML escapa <script>, aspas e & e não interpreta marcações do usuário', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${xssVersion.id}/export?format=html`)
      .set('Authorization', authorization(xssUser.token))
      .expect(200);
    const html = response.text;

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<PROJECTS_LEAK');
    expect(html).not.toContain('PROJECTS_LEAK');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt; — Currículo</title>');
  });

  it('HTML só cria href para http/https e revalida esquemas proibidos', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${xssVersion.id}/export?format=html`)
      .set('Authorization', authorization(xssUser.token))
      .expect(200);
    const html = response.text;

    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain('href="data:');
    expect(html).not.toContain('LinkedIn');
    expect(html).not.toContain('Portfólio');
    expect(html).toContain('href="https://github.com/qa?x=1&amp;y=&quot;&lt;script&gt;&quot;"');
    expect(html).toContain('>GitHub</a>');
  });

  it('HTML não renderiza projects e não contém recursos ativos nem tabelas', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=html`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const html = response.text;

    for (const forbidden of [
      '<table',
      '<img',
      '<svg',
      '<iframe',
      '<script',
      '<link',
      'src=',
      'onerror=',
      'onclick=',
      '@import',
      'display: table',
      'grid-template-columns',
    ]) {
      expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(html).not.toContain('<h2>Projetos</h2>');
  });

  it('HTML formata datas YYYY-MM como MM/YYYY e current como Atual', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=html`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const html = response.text;

    expect(html).toContain('03/2021 — Atual');
    expect(html).toContain('02/2015 — 12/2019');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('duas chamadas HTML idênticas geram os mesmos bytes e não escrevem no banco', async () => {
    const url = `/v1/resume-versions/${mainVersion.id}/export?format=html`;
    const before = await dumpExportTables(mainVersion.id);

    const first = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const after = await dumpExportTables(mainVersion.id);

    expect(second.text).toBe(first.text);
    expect(second.headers['content-type']).toBe(first.headers['content-type']);
    expect(after).toBe(before);
  });

  it('HTML não expõe atsScore, resumeId, version nem metadados de análise', async () => {
    const response = await request(app.getHttpServer())
      .get(`/v1/resume-versions/${mainVersion.id}/export?format=html`)
      .set('Authorization', authorization(user.token))
      .expect(200);
    const html = response.text;

    expect(html).not.toContain(mainVersion.id);
    expect(html).not.toContain(mainVersion.resumeId);
    expect(html).not.toMatch(/atsScore|ats_score|analysis|análise/i);
    expect(html).not.toContain('Currículo versão');
  });
});
