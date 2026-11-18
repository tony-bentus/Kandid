/** Exemplos reutilizÃ¡veis de request/response para o Swagger do domÃ­nio de perfil. */

export const PROFILE_REQUEST_EXAMPLE: Record<string, unknown> = {
  headline: 'Backend Developer',
  summary: 'Desenvolvedor backend com foco em Node.js e TypeScript.',
  phone: '+55 11 99999-9999',
  city: 'SÃ£o Paulo',
  state: 'SP',
  country: 'Brasil',
  linkedinUrl: 'https://linkedin.com/in/usuario',
  githubUrl: 'https://github.com/usuario',
  portfolioUrl: 'https://usuario.dev',
  desiredRole: 'Desenvolvedor Backend SÃªnior',
  desiredSeniority: 'SENIOR',
  workModelPreference: 'REMOTE',
  desiredSalaryCents: 1500000,
  currency: 'BRL',
  availableFrom: '2026-12-01',
};

export const PROFILE_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  userId: '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33',
  headline: 'Backend Developer',
  summary: 'Desenvolvedor backend com foco em Node.js e TypeScript.',
  phone: '+55 11 99999-9999',
  city: 'SÃ£o Paulo',
  state: 'SP',
  country: 'Brasil',
  linkedinUrl: 'https://linkedin.com/in/usuario',
  githubUrl: 'https://github.com/usuario',
  portfolioUrl: 'https://usuario.dev',
  desiredRole: 'Desenvolvedor Backend SÃªnior',
  desiredSeniority: 'SENIOR',
  workModelPreference: 'REMOTE',
  desiredSalaryCents: 1500000,
  currency: 'BRL',
  availableFrom: '2026-12-01',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const EXPERIENCE_REQUEST_EXAMPLE: Record<string, unknown> = {
  companyName: 'Acme',
  role: 'Backend Developer',
  employmentType: 'CLT',
  workModel: 'REMOTE',
  location: 'Remoto',
  startDate: '2023-01-01',
  isCurrent: true,
  description: 'AtuaÃ§Ã£o no time de plataforma.',
  sortOrder: 0,
};

export const EXPERIENCE_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  profileId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  companyName: 'Acme',
  role: 'Backend Developer',
  employmentType: 'CLT',
  workModel: 'REMOTE',
  location: 'Remoto',
  startDate: '2023-01-01',
  endDate: null,
  isCurrent: true,
  description: 'AtuaÃ§Ã£o no time de plataforma.',
  sortOrder: 0,
  bullets: [
    {
      id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      experienceId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      text: 'Reduzi o tempo de resposta da API em 40%.',
      sortOrder: 0,
      createdAt: '2026-11-10T12:00:00.000Z',
      updatedAt: '2026-11-10T12:00:00.000Z',
    },
  ],
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const BULLET_REQUEST_EXAMPLE: Record<string, unknown> = {
  text: 'Reduzi o tempo de resposta da API em 40%.',
  sortOrder: 0,
};

export const BULLET_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  experienceId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  text: 'Reduzi o tempo de resposta da API em 40%.',
  sortOrder: 0,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const PROFILE_SKILL_REQUEST_EXAMPLE: Record<string, unknown> = {
  skillId: '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e',
  level: 'ADVANCED',
  yearsExperience: 5.5,
  lastUsedYear: 2026,
};

export const PROFILE_SKILL_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a',
  profileId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  skillId: '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e',
  level: 'ADVANCED',
  yearsExperience: 5.5,
  lastUsedYear: 2026,
  skill: {
    id: '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e',
    name: 'Node.js',
    slug: 'node-js',
    category: 'FRAMEWORK',
    aliases: ['Node', 'NodeJS'],
  },
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const EDUCATION_REQUEST_EXAMPLE: Record<string, unknown> = {
  institution: 'Universidade de SÃ£o Paulo',
  degree: 'Bacharelado',
  fieldOfStudy: 'CiÃªncia da ComputaÃ§Ã£o',
  startDate: '2018-02-01',
  endDate: '2022-12-15',
  isCurrent: false,
  description: 'TCC sobre sistemas distribuÃ­dos.',
};

export const CERTIFICATION_REQUEST_EXAMPLE: Record<string, unknown> = {
  name: 'AWS Certified Solutions Architect',
  issuer: 'Amazon Web Services',
  issueDate: '2024-03-10',
  expiryDate: '2027-03-10',
  credentialUrl: 'https://www.credly.com/badges/exemplo',
  credentialId: 'ABC-123-XYZ',
};

export const LANGUAGE_REQUEST_EXAMPLE: Record<string, unknown> = {
  name: 'InglÃªs',
  proficiency: 'FLUENT',
};

export const EDUCATION_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '9c1e2d7a-6b8e-4f12-8e4f-3c4f9a9c1e2d',
  profileId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  institution: 'Universidade de SÃ£o Paulo',
  degree: 'Bacharelado',
  fieldOfStudy: 'CiÃªncia da ComputaÃ§Ã£o',
  startDate: '2018-02-01',
  endDate: '2022-12-15',
  isCurrent: false,
  description: 'TCC sobre sistemas distribuÃ­dos.',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const CERTIFICATION_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  profileId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  name: 'AWS Certified Solutions Architect',
  issuer: 'Amazon Web Services',
  issueDate: '2024-03-10',
  expiryDate: '2027-03-10',
  credentialUrl: 'https://www.credly.com/badges/exemplo',
  credentialId: 'ABC-123-XYZ',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const LANGUAGE_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  profileId: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  name: 'InglÃªs',
  proficiency: 'FLUENT',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
};

export const SKILL_SEARCH_EXAMPLE: Record<string, unknown> = {
  q: 'node',
  limit: 20,
};

export const SKILL_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e',
  name: 'Node.js',
  slug: 'node-js',
  category: 'FRAMEWORK',
  aliases: ['Node', 'NodeJS'],
};

