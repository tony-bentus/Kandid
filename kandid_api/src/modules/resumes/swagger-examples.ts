/** Exemplos reutilizáveis do Swagger de currículos e versões (KAN-40). */

export const RESUME_REQUEST_EXAMPLE: Record<string, unknown> = {
  name: 'Currículo Backend',
  targetRole: 'Desenvolvedor Backend Sênior',
  isDefault: true,
};

export const RESUME_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
  userId: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33',
  name: 'Currículo Backend',
  targetRole: 'Desenvolvedor Backend Sênior',
  isDefault: true,
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T12:00:00.000Z',
};

export const RESUME_LIST_EXAMPLE: Record<string, unknown> = {
  data: [RESUME_RESPONSE_EXAMPLE],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

export const RESUME_VERSION_REQUEST_EXAMPLE: Record<string, unknown> = {
  jobId: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d',
};

export const RESUME_VERSION_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d',
  resumeId: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
  version: 1,
  jobId: null,
  atsScore: null,
  createdAt: '2026-11-19T12:05:00.000Z',
  contentSnapshot: {
    schemaVersion: '1.0',
    targetRole: 'Desenvolvedor Backend Sênior',
    generatedAt: '2026-11-19T12:05:00.000Z',
    candidate: {
      name: 'Nome Sobrenome',
      headline: 'Backend Developer',
      email: 'email@exemplo.com',
      phone: '+55 11 99999-9999',
      location: 'São Paulo, SP, Brasil',
      links: {
        linkedin: 'https://linkedin.com/in/usuario',
        github: 'https://github.com/usuario',
        portfolio: 'https://usuario.dev',
      },
    },
    summary: 'Resumo profissional...',
    skills: [
      {
        name: 'Node.js',
        category: 'FRAMEWORK',
        level: 'ADVANCED',
        years: 5,
      },
    ],
    experiences: [
      {
        company: 'Acme',
        role: 'Backend Developer',
        employmentType: 'CLT',
        workModel: 'REMOTE',
        location: 'Remoto',
        startDate: '2021-03',
        endDate: null,
        current: true,
        highlights: ['Reduzi a latência da API em 40%.'],
      },
    ],
    education: [
      {
        institution: 'Universidade X',
        degree: 'Bacharelado',
        fieldOfStudy: 'Ciência da Computação',
        startDate: '2015-02',
        endDate: '2019-12',
        current: false,
      },
    ],
    certifications: [],
    languages: [{ name: 'Inglês', proficiency: 'ADVANCED' }],
    projects: [],
    seniority: 'SENIOR',
  },
};

/** Corpo de `GET /v1/resume-versions/:id/export?format=json` (sem envelope). */
export const RESUME_EXPORT_JSON_EXAMPLE: Record<string, unknown> = {
  resumeId: '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b',
  version: 1,
  atsScore: 78,
  contentSnapshot: RESUME_VERSION_RESPONSE_EXAMPLE.contentSnapshot,
};

/** Documento curto, porém completo, de `?format=html`. */
export const RESUME_EXPORT_HTML_EXAMPLE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nome Sobrenome — Currículo</title>
<style>/* CSS embutido, coluna única */</style>
</head>
<body>
<main>
  <header>
    <h1>Nome Sobrenome</h1>
    <p class="meta">Backend Developer</p>
    <p class="contact">email@exemplo.com · +55 11 99999-9999</p>
  </header>
  <section>
    <h2>Resumo</h2>
    <p>Resumo profissional...</p>
  </section>
</main>
</body>
</html>
`;
