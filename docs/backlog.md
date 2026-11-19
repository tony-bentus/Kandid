# Backlog — Kandid

Status: `Planejado` | `Em andamento` | `Implementado localmente` | `Concluído` | `Bloqueado`

> Decisão API-first (2026-11-09): o desenvolvimento segue com MySQL local via Docker; deploy (KAN-7) e banco remoto (KAN-8) foram adiados conscientemente e retomam **após o fechamento da Sprint 5**.

## Épicos

| ID | Épico | Sprint | Status |
|---|---|---|---|
| E0 | Fundação, agentes e CI/CD | 0 | Concluído localmente (deploy adiado) |
| E1 | Autenticação e perfil | 1–2 | Concluído (PR #12 mergeado em main) |
| E2 | Empresas, recrutadores e vagas | 3 | Concluído (PR #12 mergeado em main) |
| E3 | Candidaturas e máquina de estados | 4 | Concluído (PR #12 mergeado em main) |
| E4 | Currículos e motor ATS | 5 | Implementado localmente (Sprint 5, aguardando revisão/commit) |
| E5 | Export, dashboard e entrevistas | 6 | Planejado |
| E6 | Hardening e release v1.0.0 | 7 | Planejado |

## Histórias

### E0 — Sprint 0

| ID | História | Status |
|---|---|---|
| KAN-1 | Reestruturar repositório em monorepo na raiz | Concluído |
| KAN-2 | Configurar agentes, comandos e permissões | Concluído |
| KAN-3 | Configurar env, TypeORM, migrations e Docker Compose | Concluído |
| KAN-4 | Adicionar Swagger, validação global e filtro de erros | Concluído |
| KAN-5 | Criar `GET /v1/health` | Concluído |
| KAN-6 | CI com lint, build, testes e MySQL | Concluído (aguardando 1º PR) |
| KAN-7 | CD para o ambiente demo | Adiado (retoma após a Sprint 5) |
| KAN-8 | Spike e ADR de banco de dados | Adiado (retoma após a Sprint 5) |

### E1 — Autenticação e perfil

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-10 | Registrar usuário | 1 | Concluído (PR #12 mergeado em main) |
| KAN-11 | Autenticar com JWT | 1 | Concluído (PR #12 mergeado em main) |
| KAN-12 | Consultar usuário autenticado | 1 | Concluído (PR #12 mergeado em main) |
| KAN-13 | Criar e atualizar perfil | 2 | Concluído (PR #12 mergeado em main) |
| KAN-14 | CRUD de experiências e bullets | 2 | Concluído (PR #12 mergeado em main) |
| KAN-15 | Catálogo e vínculo de skills | 2 | Concluído (PR #12 mergeado em main) |
| KAN-16 | Formação, certificações e idiomas | 2 | Concluído (PR #12 mergeado em main) |

> Sprint 2 (KAN-13 a KAN-16) implementada e validada em 2026-11-18 na branch
> `feat/sprint-2-profile` (HEAD `00b0647`) e mergeada em `main` via **PR #12**
> (merge commit `46f4e8a`), junto com as Sprints 1, 3 e 4. Sobre o estado mergeado:
> `npm test` 232/232, `npm run test:e2e` 192/192, `npm run lint` exit 0 (1 warning
> preexistente em `test/auth.e2e-spec.ts:232`), `npx tsc --noEmit` exit 0,
> `npm run build` exit 0 e `git diff --check` exit 0. O catálogo de skills é semeado
> por `npm run seed:skills` (118 skills, 84 aliases), de forma local e explícita —
> nunca em bootstrap ou migration. Os workflows de CD e Dependabot seguem ativos e
> sem alteração, com a decisão sobre o ambiente demo registrada como pendência
> para depois da Sprint 5. Detalhes em
> [`docs/sprints/sprint-02.md`](sprints/sprint-02.md) e
> [`ADR 0002`](adr/0002-sprint-2-profile.md).

### E2 — Pipeline

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-20 | CRUD de empresas | 3 | Concluído (PR #12 mergeado em main) |
| KAN-21 | CRUD de recrutadores | 3 | Concluído (PR #12 mergeado em main) |
| KAN-22 | CRUD de vagas com stack e faixa | 3 | Concluído (PR #12 mergeado em main) |

> Sprint 3 (KAN-20 a KAN-22) implementada em 2026-11-18 na branch
> `feat/sprint-2-profile` (HEAD `00b0647`) e mergeada em `main` via **PR #12**
> (merge commit `46f4e8a`): CRUD de empresas, recrutadores e vagas com stack,
> senioridade, faixa salarial, filtros e paginação. Sobre o estado mergeado:
> `npm test` 232/232, `npm run test:e2e` 192/192, `npm run lint` exit 0 (1 warning
> preexistente em `test/auth.e2e-spec.ts:232`), `npx tsc --noEmit` exit 0,
> `npm run build` exit 0 e `git diff --check` exit 0. A migration
> `1794960000000-CreatePipelineDomain` foi aplicada, revertida e reaplicada com
> `schema:log` sem drift. Decisões e contratos em
> [`docs/sprints/sprint-03.md`](sprints/sprint-03.md) e
> [`ADR 0003`](adr/0003-sprint-3-pipeline.md).

### E3 — Candidaturas

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-30 | Criar candidatura para vaga | 4 | Concluído (PR #12 mergeado em main) |
| KAN-31 | Transicionar status com histórico | 4 | Concluído (PR #12 mergeado em main) |
| KAN-32 | Registrar valores proposto e ofertado | 4 | Concluído (PR #12 mergeado em main) |
| KAN-33 | Filtrar e paginar candidaturas | 4 | Concluído (PR #12 mergeado em main) |

> Sprint 4 (KAN-30 a KAN-33) implementada em 2026-11-18 na branch
> `feat/sprint-2-profile` (HEAD `00b0647`) e mergeada em `main` via **PR #12**
> (merge commit `46f4e8a`), sem release ou deploy: enum `ApplicationStatus` e
> `APPLICATION_TRANSITIONS`, entidades `Application` e
> `ApplicationStatusHistory` (tabela `application_status_history`, no singular),
> DTOs, serviço transacional, 6 rotas em `/v1` com Swagger, migration
> `1795046400000-CreateApplicationsDomain` e `DELETE /v1/jobs/:id` → 409 quando
> há candidatura. `GET /v1/applications` filtra por `status`, `companyId`, `from`,
> `to`, `page` e `limit`, responde com envelope `{ data, meta }` e rejeita `sort`
> com 400. Sobre o estado mergeado: `npm test` 232/232, `npm run test:e2e`
> 192/192, `npm run lint` exit 0 (1 warning preexistente em
> `test/auth.e2e-spec.ts:232`), `npx tsc --noEmit` exit 0, `npm run build` exit 0
> e `git diff --check` exit 0; migration aplicada, revertida e reaplicada,
> `migration:show` com 4 aplicadas e `schema:log` via CLI direto
> (`npm run typeorm -- schema:log -d src/database/data-source.ts`) sem drift.
> **Portão humano:** a demo manual da Sprint 4 ainda não foi executada e as 8
> ambiguidades registradas seguem sujeitas à decisão humana — nenhuma bloqueou o
> merge do PR #12. Detalhes em
> [`docs/sprints/sprint-04.md`](sprints/sprint-04.md) e
> [`ADR 0004`](adr/0004-sprint-4-applications.md).

### E4 — Currículo e ATS

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-40 | Criar currículo e gerar versão | 5 | Implementado localmente (Sprint 5 - branch feat/sprint-5-resumes, aguardando revisão/commit) |
| KAN-41 | Extrair keywords da vaga | 5 | Implementado localmente (Sprint 5 - branch feat/sprint-5-resumes, aguardando revisão/commit) |
| KAN-42 | Calcular score e checks | 5 | Implementado localmente (Sprint 5 - branch feat/sprint-5-resumes, aguardando revisão/commit) |
| KAN-43 | Persistir e consultar análise | 5 | Implementado localmente (Sprint 5 - branch feat/sprint-5-resumes, aguardando revisão/commit) |

> **Sprint 5 (implementada e validada localmente):** branch de trabalho
> `feat/sprint-5-resumes`, criada a partir de `46f4e8a`. A implementação e a
> validação local estão concluídas; **não há commit, push, PR, merge nem deploy**.
> Escopo entregue: KAN-40 a KAN-43 — currículos versionados e ATS determinístico
> (`resumes`, `resume_versions` (append-only) e `ats_analyses`; motor puro em
> `src/modules/ats/engine/`; 9 rotas em `/v1/resumes` e
> `/v1/resume-versions/:id`). Migration `1795737600000-CreateResumeDomain`
> validada com `run` → `revert` → `run` → `show` e `schema:log` sem drift.
> Validação local: `npm test` 311/311, `npm run test:e2e` 257/257 (inclui
> `test/resumes.e2e-spec.ts` com 65 testes), `npx tsc --noEmit`, `npm run lint`,
> `npm run build` e `git diff --check` exit 0. Decisões em
> [`docs/sprints/sprint-05.md`](sprints/sprint-05.md) e
> [`docs/adr/0005-sprint-5-resumes-ats.md`](adr/0005-sprint-5-resumes-ats.md).
> **Pendentes:** revisão, commit, push, PR, merge/deploy, demo manual e portão
> humano. Export JSON/HTML fica para a Sprint 6 (KAN-50/51).

> Sprint 6 em validação na branch `feat/sprint-6-export-dashboard` (base
> `667bf83`): KAN-50..54 implementados (export JSON/HTML, CRUD de entrevistas e
> dashboards de funil/compensação). Validação até aqui: `npx tsc --noEmit`,
> `npm run lint`, `npm run build`, `npm test` 387/387 e `git diff --check` exit 0;
> migration `1795824000000-CreateInterviewDomain` validada com
> `run` → `revert` → `run` → `show` e `schema:log` sem drift. E2e: export
> 30/30, entrevistas 46/46, dashboards 18/18; suíte e2e completa 357/357.
> Revisão: aprovado com ressalvas, sem bloqueante; achados aplicados em
> `feedback` (≤5000) e query params (inclusive `?_noQueryParams=` vazio).
> **Pendentes:** commit, push, PR, merge/deploy, demo manual e portão humano.
> Decisões em
> [`docs/sprints/sprint-06.md`](sprints/sprint-06.md) e
> [`docs/adr/0006-sprint-6-export-dashboard.md`](adr/0006-sprint-6-export-dashboard.md).

### E5 — Export e dashboard

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-50 | Exportar currículo em JSON | 6 | Em validação |
| KAN-51 | Exportar currículo em HTML | 6 | Em validação |
| KAN-52 | CRUD de entrevistas | 6 | Em validação |
| KAN-53 | Dashboard de funil | 6 | Em validação |
| KAN-54 | Dashboard de compensação | 6 | Em validação |

### E6 — Hardening

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-60 | Seed de demonstração | 7 | Planejado |
| KAN-61 | CodeQL, Dependabot e Sentry | 7 | Planejado |
| KAN-62 | README de portfólio | 7 | Planejado |
| KAN-63 | Release v1.0.0 | 7 | Planejado |
