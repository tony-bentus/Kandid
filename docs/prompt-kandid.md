# Prompt de implementação — Kandid API

> Documento de definição do projeto. Use este arquivo como briefing completo para implementar (ou continuar) a Kandid API.
> Última atualização: 2026-11-05

## Papel

Você é um engenheiro backend sênior especializado em NestJS, TypeScript e modelagem de domínio. Implemente a API descrita abaixo de forma incremental, com testes, migrations e documentação. Priorize clareza de domínio e regras explicáveis em vez de quantidade de endpoints.

## Contexto

- Repositório da API: `kandid_api/` (já existe um scaffold NestJS funcional).
- O projeto é **pessoal, para estudo e portfólio**. Não há objetivo comercial.
- O diferencial precisa aparecer no código: modelagem relacional bem pensada, máquina de estados auditável e um motor ATS determinístico e testável.
- Existe um `docs/` na raiz do workspace; este arquivo vive nele.

## Objetivo

Criar uma API REST para uma pessoa gerenciar sua busca por emprego:

1. Cadastrar perfil profissional estruturado (experiências, skills, formação, certificações, idiomas).
2. Gerar currículos a partir desse perfil, com versões por vaga e export em JSON/HTML.
3. Analisar a aderência do currículo a uma vaga usando um motor ATS determinístico e explicável.
4. Acompanhar candidaturas: vaga, empresa, recrutador, valores propostos/ofertados, status, histórico e entrevistas.
5. Exibir métricas do processo (funil, taxa de resposta, proposta × ofertado).

## Stack e convenções do repositório

Trabalhe em `kandid_api/` e respeite o que já está configurado:

- **NestJS 12** + **TypeORM** + **MySQL 8**
- **ESM**: `package.json` tem `"type": "module"`. **Todos os imports relativos devem terminar em `.js`** (ex.: `import { X } from './x.service.js'`). Nunca use `require()`.
- **TypeScript strict** (`tsconfig.json`). Não use `any` sem necessidade.
- **Vitest** para testes (`*.spec.ts` unitários, `test/*.e2e-spec.ts` e2e) + **supertest**.
- **oxlint** (`npm run lint`) e **Prettier** (`singleQuote: true`, `trailingComma: 'all'`).
- Scripts existentes: `start:dev`, `build`, `lint`, `test`, `test:e2e`, `format`.
- Não recrie o projeto do zero: adapte o scaffold existente.

### Dependências a adicionar

```text
@nestjs/config  @nestjs/swagger  @nestjs/jwt  class-validator  class-transformer  argon2
```

Ferramentas de apoio (dev): `@testcontainers/mysql` (ou MySQL local via Docker Compose).

## Escopo

### Dentro do escopo (MVP)

- Auth simples: registro, login e `GET /me` com JWT.
- Perfil, experiências + bullets, skills, formação, certificações, idiomas.
- Empresas (cliente/agência) e recrutadores.
- Vagas com stack, senioridade, modelo de trabalho, faixa salarial e origem.
- Candidaturas com status, histórico append-only e entrevistas.
- Currículos + versões imutáveis (snapshot JSON).
- Motor ATS determinístico (sem IA).
- Export do currículo em **JSON** e **HTML**.
- Dashboard com funil e comparativo de compensação.
- Seed do catálogo de skills e de dados de demonstração.
- Swagger, migrations, docker-compose, README.

### Fora do escopo (NÃO implementar)

- Geração de PDF ou DOCX.
- Integração com LLM/IA de qualquer tipo.
- Billing, planos, multi-tenant, convites, times.
- Upload/armazenamento de arquivos.
- Importação de currículo existente.
- Parsing automático de vaga por URL.
- Roles/permissões além de "usuário autenticado".
- Telemetria do NestJS Observe (ignorar o `AGENTS.md` nesse ponto).

## Modelo de dados

Convenções gerais:

- Chaves primárias `uuid` (`@PrimaryGeneratedColumn('uuid')`).
- `created_at` / `updated_at` em UTC (`@CreateDateColumn` / `@UpdateDateColumn`).
- Dinheiro sempre em **centavos**, tipo `bigint`, acompanhado de `currency` (`char(3)`, default `BRL`) e `salary_period`.
- Enums como string enums do TypeScript, persistidos como `enum` do MySQL.
- Toda entidade raiz tem `user_id`; toda consulta é escopada pelo usuário autenticado.
- `resume_version` e `application_status_history` são imutáveis (nunca `UPDATE`).

### Identidade e perfil

**`user`**
`id`, `name varchar(120)`, `email varchar(160) unique`, `password_hash varchar(255)`, `created_at`, `updated_at`, `deleted_at nullable`.

**`profile`** (1:1 com user, `user_id unique`)
`id`, `user_id`, `headline varchar(160)`, `summary text`, `phone varchar(30)`, `city varchar(80)`, `state varchar(80)`, `country varchar(80)`, `linkedin_url varchar(255)`, `github_url varchar(255)`, `portfolio_url varchar(255)`, `desired_role varchar(160)`, `desired_seniority enum nullable`, `work_model_preference enum nullable`, `desired_salary_cents bigint nullable`, `currency char(3)`, `available_from date nullable`.

**`skill`** (catálogo global, semeado)
`id`, `name varchar(80) unique`, `slug varchar(80) unique`, `category enum`, `aliases json` (array de strings).

Exemplos de `aliases` que precisam existir:
`JavaScript: ["JS", "ECMAScript"]`, `TypeScript: ["TS"]`, `Node.js: ["Node", "NodeJS"]`, `C#: ["CSharp", "DotNet C#"]`, `.NET: ["DotNet", "dotnet"]`, `C++: ["CPP"]`, `PostgreSQL: ["Postgres"]`, `Kubernetes: ["K8s"]`.

**`profile_skill`**
`id`, `profile_id`, `skill_id`, `level enum`, `years_experience decimal(4,1) nullable`, `last_used_year smallint nullable`.
Constraint: `unique(profile_id, skill_id)`.

**`experience`**
`id`, `profile_id`, `company_name varchar(160)`, `role varchar(160)`, `employment_type enum nullable`, `work_model enum nullable`, `location varchar(160)`, `start_date date`, `end_date date nullable`, `is_current boolean default false`, `description text nullable`, `sort_order int default 0`.

**`experience_bullet`**
`id`, `experience_id`, `text varchar(500)`, `sort_order int`.
Uma conquista por linha. `ON DELETE CASCADE` a partir da experiência.

**`education`**
`id`, `profile_id`, `institution varchar(160)`, `degree varchar(160)`, `field_of_study varchar(160)`, `start_date date`, `end_date date nullable`, `is_current boolean`, `description text nullable`.

**`certification`**
`id`, `profile_id`, `name varchar(160)`, `issuer varchar(160)`, `issue_date date`, `expiry_date date nullable`, `credential_url varchar(255)`, `credential_id varchar(120)`.

**`language`**
`id`, `profile_id`, `name varchar(60)`, `proficiency enum`.

### Empresas, recrutadores e vagas

**`company`**
`id`, `user_id`, `name varchar(160)`, `kind enum`, `website varchar(255)`, `industry varchar(120)`, `size enum nullable`, `location varchar(160)`, `notes text`.
Constraint: `unique(user_id, name)`.

**`recruiter`**
`id`, `user_id`, `name varchar(120)`, `email varchar(160)`, `phone varchar(30)`, `linkedin_url varchar(255)`, `agency_company_id uuid nullable` (FK `company`), `notes text`.

**`job`**
`id`, `user_id`, `company_id uuid`, `recruiter_id uuid nullable`, `title varchar(160)`, `description text`, `seniority enum nullable`, `work_model enum nullable`, `contract_type enum nullable`, `location varchar(160)`, `source enum`, `source_url varchar(255)`, `salary_range_min_cents bigint nullable`, `salary_range_max_cents bigint nullable`, `currency char(3)`, `salary_period enum`, `posted_at date nullable`, `application_deadline date nullable`, `notes text`.

**`job_skill`**
`job_id`, `skill_id`, `is_required boolean default true`.
Primary key composta `(job_id, skill_id)`.

### Candidaturas

**`application`**
`id`, `user_id`, `job_id`, `status enum`, `applied_at date nullable`, `resume_version_id uuid nullable`, `proposed_salary_cents bigint nullable`, `offered_salary_cents bigint nullable`, `currency char(3)`, `salary_period enum`, `benefits json nullable`, `next_step_at datetime nullable`, `last_contact_at datetime nullable`, `rejection_reason varchar(500)`, `closed_at datetime nullable`, `notes text`.
Constraint: `unique(user_id, job_id)`.

**`application_status_history`** (append-only)
`id`, `application_id`, `from_status enum nullable`, `to_status enum`, `note varchar(500)`, `changed_at datetime`.

**`interview`**
`id`, `application_id`, `round int`, `type enum`, `scheduled_at datetime`, `duration_minutes int`, `interviewer_name varchar(120)`, `interviewer_role varchar(120)`, `meeting_url varchar(255)`, `status enum`, `feedback text`, `outcome enum`.

### Currículos e ATS

**`resume`**
`id`, `user_id`, `name varchar(120)`, `target_role varchar(160)`, `is_default boolean`, `created_at`, `updated_at`.

**`resume_version`** (imutável)
`id`, `resume_id`, `version int`, `job_id uuid nullable`, `content_snapshot json`, `ats_score int nullable`, `created_at`.
Constraint: `unique(resume_id, version)`.

**`ats_analysis`**
`id`, `resume_version_id`, `job_id`, `score int`, `breakdown json`, `checks json`, `matched_keywords json`, `missing_keywords json`, `created_at`.

## Enums

```text
Seniority:            INTERN | JUNIOR | MID | SENIOR | LEAD | STAFF | PRINCIPAL
WorkModel:            ONSITE | HYBRID | REMOTE
ContractType:         CLT | PJ | CONTRACTOR | FREELANCE | INTERNSHIP | TEMPORARY
SalaryPeriod:         MONTH | YEAR | HOUR | DAY
CompanyKind:          CLIENT | AGENCY | OTHER
CompanySize:          MICRO | SMALL | MEDIUM | LARGE | ENTERPRISE
SkillCategory:        LANGUAGE | FRAMEWORK | DATABASE | CLOUD | DEVOPS | TOOL | METHODOLOGY | SOFT_SKILL
SkillLevel:           BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
LanguageProficiency:  BASIC | INTERMEDIATE | ADVANCED | FLUENT | NATIVE
JobSource:            LINKEDIN | GUPY | INDEED | REFERRAL | COMPANY_SITE | OTHER
ApplicationStatus:    SAVED | APPLIED | SCREENING | SCHEDULED | INTERVIEW | OFFER | HIRED | REJECTED | WITHDRAWN | CANCELLED | GHOSTED
InterviewType:        HR | TECHNICAL | BEHAVIORAL | CASE | CULTURAL | FINAL
InterviewStatus:      SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
InterviewOutcome:     PENDING | PASSED | FAILED
```

## Máquina de estados da candidatura

Transições permitidas:

```text
SAVED       -> APPLIED | CANCELLED
APPLIED     -> SCREENING | SCHEDULED | REJECTED | GHOSTED | WITHDRAWN | CANCELLED
SCREENING   -> SCHEDULED | INTERVIEW | REJECTED | GHOSTED | WITHDRAWN | CANCELLED
SCHEDULED   -> INTERVIEW | REJECTED | GHOSTED | WITHDRAWN | CANCELLED
INTERVIEW   -> OFFER | REJECTED | GHOSTED | WITHDRAWN | CANCELLED
OFFER       -> HIRED | REJECTED | WITHDRAWN | CANCELLED
GHOSTED     -> SCREENING | SCHEDULED | INTERVIEW | REJECTED | WITHDRAWN
HIRED       -> (terminal)
REJECTED    -> (terminal)
WITHDRAWN   -> (terminal)
CANCELLED   -> (terminal)
```

Regras:

- Validar transições em um único mapa exportado (`APPLICATION_TRANSITIONS`), coberto por teste unitário.
- Ao transicionar: atualizar `application.status` **e** inserir `application_status_history` na mesma transação.
- Ao entrar em `APPLIED`, preencher `applied_at` se estiver vazio.
- Ao entrar em estado terminal, preencher `closed_at`.
- Transição inválida → `400 Bad Request` com mensagem listando os estados permitidos.
- `PATCH /applications/:id/status` exige `{ status, note? }`.

## Motor ATS determinístico

Implementar em `src/modules/ats/engine/`, com cada etapa pura, isolada e testável por unit test.

### 1. Normalização (`normalizer.ts`)

- lowercase
- remover acentos
- colapsar espaços
- canonicalizar símbolos antes de tokenizar: `c++ -> cpp`, `c# -> csharp`, `.net -> dotnet`, `node.js -> nodejs`, `ci/cd -> cicd`
- preservar números relevantes (anos de experiência)

### 2. Extração de keywords da vaga (`job-parser.ts`)

Entrada: `job.description` (texto livre) + catálogo de skills.
Saída: `{ required: SkillMatch[], niceToHave: SkillMatch[], yearsRequired?: number, seniorityHint?: Seniority }`.

- Dividir em linhas/blocos e detectar seções por títulos:
  - obrigatórias: `requisitos`, `requirements`, `must have`, `obrigatório`, `necessário`
  - desejáveis: `diferenciais`, `nice to have`, `desejável`, `plus`, `preferencial`
- Se não houver seção reconhecida, todos os matches são `required`.
- Extrair anos exigidos com regex `(\d+)\s*\+?\s*(anos|years)`.
- Fazer matching contra `skill.name` + `skill.aliases`, ordenando aliases por tamanho decrescente para evitar match parcial.
- Deduplicar por `skill_id`.

### 3. Extração do currículo (`resume-extractor.ts`)

Entrada: `content_snapshot` do `resume_version`.
Saída: texto ponderado por seção.

Pesos sugeridos:

| Seção | Peso |
|---|---|
| `summary` | 2 |
| highlights das 2 experiências mais recentes | 3 |
| demais highlights | 1 |
| `skills` | 2 |
| `projects` | 1 |

Uma keyword é considerada **presente** se aparecer em qualquer seção com peso ≥ 1. O peso da seção entra no cálculo de cobertura.

### 4. Score (`scorer.ts`)

Score final de 0 a 100, com breakdown explicável.

| Dimensão | Peso | Cálculo |
|---|---|---|
| Hard skills obrigatórias | 35 | `35 * (peso dos matches / peso total exigido)` |
| Hard skills desejáveis | 10 | `10 * (peso dos matches / peso total desejável)` |
| Senioridade | 20 | igual = 100; diferença de 1 nível = 60; diferença ≥ 2 = 0 |
| Anos de experiência | 15 | `min(100, anosReais / anosExigidos * 100)` |
| Formação/certificação | 10 | requisito detectado e atendido = 100; detectado e não atendido = 0 |
| Idiomas | 5 | requisito detectado e atendido = 100; caso contrário 0 |
| Estrutura do currículo | 5 | proporção de checks aprovados |

- Anos reais = soma das durações das experiências (considerar `is_current` até hoje).
- Se uma dimensão não for aplicável (vaga não exige anos, não menciona formação etc.), marcá-la como `notApplicable` e **renormalizar os pesos proporcionalmente** entre as dimensões aplicáveis.
- Arredondar para inteiro e limitar a `[0, 100]`.
- Retornar `matched` e `missing` por dimensão.

Formato de saída persistido em `ats_analysis`:

```json
{
  "score": 78,
  "breakdown": [
    {
      "dimension": "requiredSkills",
      "weight": 35,
      "earned": 28,
      "applicable": true,
      "matched": ["Node.js", "TypeScript"],
      "missing": ["Kubernetes"],
      "detail": "2 de 3 skills obrigatórias encontradas"
    }
  ],
  "checks": [
    { "id": "has-summary", "passed": true, "detail": null },
    { "id": "bullet-length", "passed": false, "detail": "2 bullets acima de 220 caracteres" }
  ],
  "matchedKeywords": ["Node.js", "TypeScript"],
  "missingKeywords": ["Kubernetes"]
}
```

### 5. Checks estruturais (`checks.ts`)

Avaliar o snapshot (não o HTML):

- `has-summary`
- `has-contact` (e-mail e telefone)
- `has-experience`
- `has-highlights`
- `dates-consistent` (toda experiência tem `startDate`; `current=true` não tem `endDate`)
- `no-empty-required-sections`
- `bullet-length` (≤ 220 caracteres)
- `has-skills`
- `target-role-defined`
- `no-duplicate-skills`

## Contrato do snapshot do currículo

O snapshot é imutável, versionado e serve de entrada para ATS e export.

```json
{
  "schemaVersion": "1.0",
  "targetRole": "Desenvolvedor Backend Sênior",
  "generatedAt": "2026-11-05T12:00:00Z",
  "candidate": {
    "name": "Nome Sobrenome",
    "headline": "Backend Developer",
    "email": "email@exemplo.com",
    "phone": "+55 11 99999-9999",
    "location": "São Paulo, SP, Brasil",
    "links": {
      "linkedin": "https://linkedin.com/in/usuario",
      "github": "https://github.com/usuario",
      "portfolio": "https://usuario.dev"
    }
  },
  "summary": "Resumo profissional...",
  "skills": [
    { "name": "Node.js", "category": "FRAMEWORK", "level": "ADVANCED", "years": 5 }
  ],
  "experiences": [
    {
      "company": "Acme",
      "role": "Backend Developer",
      "employmentType": "CLT",
      "workModel": "REMOTE",
      "location": "Remoto",
      "startDate": "2021-03",
      "endDate": null,
      "current": true,
      "highlights": ["Reduzi a latência da API em 40%..."]
    }
  ],
  "education": [
    {
      "institution": "Universidade X",
      "degree": "Bacharelado",
      "fieldOfStudy": "Ciência da Computação",
      "startDate": "2015-02",
      "endDate": "2019-12",
      "current": false
    }
  ],
  "certifications": [],
  "languages": [{ "name": "Inglês", "proficiency": "ADVANCED" }],
  "projects": []
}
```

- `POST /resumes/:id/versions` gera o snapshot a partir do perfil e incrementa `version` (transação + lock para evitar duplicidade).
- O snapshot **não muda** depois de criado.

## Export

- `GET /v1/resume-versions/:id/export?format=json`
  - Retorna `application/json` com o snapshot + metadados (`resumeId`, `version`, `atsScore`).
- `GET /v1/resume-versions/:id/export?format=html`
  - Retorna `text/html; charset=utf-8` gerado **on demand** a partir do snapshot.
  - HTML5 semântico, coluna única, CSS inline, `lang="pt-BR"`, sem tabelas, imagens, ícones ou JavaScript.
  - Escapar todo conteúdo do usuário (prevenção de XSS).
  - Títulos de seção padrão: `Resumo`, `Habilidades`, `Experiência Profissional`, `Formação`, `Certificações`, `Idiomas`.
- `format` inválido ou ausente → `400`. Default não é permitido: exigir o parâmetro.

## API (`/v1`)

Definir prefixo global `v1` e Swagger em `/docs`.

```text
POST   /v1/auth/register
POST   /v1/auth/login
GET    /v1/auth/me

GET    /v1/me/profile
PATCH  /v1/me/profile

POST   /v1/me/experiences
GET    /v1/me/experiences
GET    /v1/me/experiences/:id
PATCH  /v1/me/experiences/:id
DELETE /v1/me/experiences/:id
POST   /v1/me/experiences/:id/bullets
PATCH  /v1/me/experiences/:id/bullets/:bulletId
DELETE /v1/me/experiences/:id/bullets/:bulletId

CRUD   /v1/me/educations
CRUD   /v1/me/certifications
CRUD   /v1/me/languages
CRUD   /v1/me/skills
GET    /v1/skills?q=

CRUD   /v1/companies          (?kind=CLIENT|AGENCY|OTHER)
CRUD   /v1/recruiters
CRUD   /v1/jobs               (?status&companyId&seniority&skillId&q&page&limit)
GET    /v1/jobs/:id/application

POST   /v1/jobs/:id/applications
GET    /v1/applications       (?status&companyId&from&to&page&limit)
GET    /v1/applications/:id
PATCH  /v1/applications/:id/status
PATCH  /v1/applications/:id/compensation
GET    /v1/applications/:id/history
CRUD   /v1/applications/:id/interviews

CRUD   /v1/resumes
POST   /v1/resumes/:id/versions
GET    /v1/resume-versions/:id
POST   /v1/resume-versions/:id/analyze
GET    /v1/resume-versions/:id/export?format=json|html

GET    /v1/dashboard/summary
GET    /v1/dashboard/compensation
GET    /v1/health
```

### Convenções de API

- **Auth**: `Authorization: Bearer <jwt>`. Senha com **argon2id**. Token de acesso com 1h de validade. Sem refresh token no MVP.
- **Validação**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` global.
- **Ownership**: extrair `userId` do JWT; nunca aceitar `user_id` no body. Recurso de outro usuário → `404 Not Found` (não revelar existência).
- **Paginação**: `page` (default 1) e `limit` (default 20, máximo 100). Resposta `{ data, meta: { page, limit, total, totalPages } }`.
- **Ordenação**: `sort=campo:asc|desc` com whitelist por recurso.
- **Datas**: `YYYY-MM-DD` para datas, ISO 8601 UTC para datetimes.
- **Erros**: formato único `{ statusCode, error, message, path, timestamp }` via exception filter global.
- **Status HTTP**: `201` em criação, `200` em leitura/atualização, `204` em delete.
- **Swagger**: todo endpoint e DTO documentados, com exemplos de request/response.
- **Transações**: obrigatórias em criação de candidatura, transição de status, geração de versão de currículo e análise ATS.

## Estrutura de pastas

```text
src/
  main.ts
  app.module.ts
  config/
    env.validation.ts
    configuration.ts
  database/
    data-source.ts
    migrations/
    seeds/
      skills.seed.ts
      demo.seed.ts
  common/
    enums/
    filters/http-exception.filter.ts
    guards/jwt-auth.guard.ts
    decorators/current-user.decorator.ts
    pagination/
    utils/ (money.ts, dates.ts, normalize.ts)
  modules/
    auth/
    users/
    profiles/
    experiences/
    skills/
    companies/
    recruiters/
    jobs/
    applications/
    interviews/
    resumes/
    ats/
      engine/
        normalizer.ts
        job-parser.ts
        resume-extractor.ts
        scorer.ts
        checks.ts
      ats.service.ts
    dashboard/
  Each module: dto/, entities/, *.module.ts, *.controller.ts, *.service.ts, *.spec.ts
```

## Fases de implementação

Implemente na ordem. Cada fase termina com `npm run lint`, `npm run test` e `npm run build` verdes.

### Fase 0 — Fundação

- `ConfigModule` com validação de env; `.env.example`; remover credenciais hardcoded do `app.module.ts`.
- `synchronize: false` + `DataSource` + migrations.
- `docker-compose.yml` com MySQL 8 e volume persistente.
- `ValidationPipe`, exception filter global, prefixo `v1`.
- Swagger em `/docs`.
- Auth: register, login, me; guard JWT; argon2.
- `GET /health`.

**Pronto quando:** subir MySQL via Docker, rodar migrations e autenticar via Swagger.

### Fase 1 — Perfil

- Entidades: `profile`, `skill`, `profile_skill`, `experience`, `experience_bullet`, `education`, `certification`, `language`.
- Seed do catálogo de skills (mínimo 80 skills com aliases, cobrindo linguagens, frameworks, bancos, cloud, devops, metodologias).
- CRUD por usuário + autocomplete `GET /skills?q=`.

**Pronto quando:** e2e registra usuário, preenche perfil completo e lista os dados.

### Fase 2 — Pipeline

- Entidades: `company`, `recruiter`, `job`, `job_skill`, `application`, `application_status_history`.
- Mapa de transições + validação + histórico transacional.
- Filtros e paginação de vagas/candidaturas.

**Pronto quando:** e2e percorre `SAVED -> APPLIED -> SCREENING -> SCHEDULED -> INTERVIEW -> OFFER -> HIRED`, valida histórico e rejeita transição inválida.

### Fase 3 — Currículo + ATS

- Entidades: `resume`, `resume_version`, `ats_analysis`.
- Builder de snapshot a partir do perfil.
- Motor ATS completo com specs e fixtures.
- Export JSON/HTML.
- `POST /analyze` persiste análise e atualiza `ats_score`.

**Pronto quando:** unit tests do motor cobrem vaga realista + currículo, e o e2e gera versão, analisa e exporta HTML válido.

### Fase 4 — Entrevistas, dashboard e polimento

- CRUD de entrevistas vinculado à candidatura.
- `GET /dashboard/summary`: contagem por status, taxa de resposta, taxa de entrevista, taxa de oferta, tempo médio até primeira resposta e por etapa.
- `GET /dashboard/compensation`: proposto × ofertado (diferença absoluta e percentual), média por senioridade e por skill.
- Seed de demonstração: usuário `demo@kandid.dev`, 2 empresas, 2 recrutadores, 4 vagas, 3 candidaturas em status diferentes, 1 currículo com 2 versões e análises.
- README com: visão geral, diagrama (Mermaid), decisões de arquitetura, fórmula do ATS, exemplos `curl`, instruções de setup e testes.

**Pronto quando:** `npm run seed` popula o banco e o dashboard retorna dados coerentes.

## Testes mínimos

**Unitários**

- `normalizer.spec.ts`: acentos, símbolos, `C++`, `C#`, `.NET`, `Node.js`.
- `job-parser.spec.ts`: seções obrigatórias × desejáveis, anos exigidos, ausência de seções.
- `scorer.spec.ts`: cobertura, senioridade, dimensões não aplicáveis com renormalização, clamp 0–100.
- `checks.spec.ts`: cada check aprovado e reprovado.
- `application-transitions.spec.ts`: matriz completa de transições válidas e inválidas.

**E2E**

- Auth: register, login, rota protegida sem token.
- Ciclo completo de candidatura.
- Isolamento entre usuários (usuário B não acessa recurso de A).
- Currículo: criar → gerar versão → analisar → exportar JSON/HTML.

## Seed

- Catálogo de skills global, idempotente (`upsert` por slug).
- Seed de demo separado, executável via `npm run seed:demo`, com dados realistas em português.
- Nunca rodar seed de demo automaticamente em produção.

## Definition of Done

- [ ] `npm run lint`, `npm run test`, `npm run test:e2e` e `npm run build` passando.
- [ ] Migrations versionadas e `synchronize: false`.
- [ ] Swagger completo e acessível em `/docs`.
- [ ] Nenhuma credencial ou segredo no código.
- [ ] README atualizado com setup, arquitetura, decisões e exemplos.
- [ ] Todos os recursos escopados por `user_id`.
- [ ] Snapshot e histórico de status comprovadamente imutáveis.
- [ ] Motor ATS com testes unitários e justificativas no retorno.

## Restrições finais

- Não adicione entidades ou endpoints fora deste documento sem perguntar antes.
- Não implemente PDF/DOCX, IA, billing ou upload de arquivos.
- Não use `synchronize: true` fora de um eventual ambiente de teste local.
- Mantenha o padrão ESM com imports `.js`.
- Prefira código explícito e testável a abstrações prematuras.
- Em caso de ambiguidade de produto, registre a dúvida antes de decidir.
