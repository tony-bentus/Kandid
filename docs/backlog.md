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
| E4 | Currículos e motor ATS | 5 | Em planejamento (Sprint 5) |
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
| KAN-40 | Criar currículo e gerar versão | 5 | Planejado (Sprint 5 — planejamento documentado na branch feat/sprint-5-resumes) |
| KAN-41 | Extrair keywords da vaga | 5 | Planejado (Sprint 5 — planejamento documentado na branch feat/sprint-5-resumes) |
| KAN-42 | Calcular score e checks | 5 | Planejado (Sprint 5 — planejamento documentado na branch feat/sprint-5-resumes) |
| KAN-43 | Persistir e consultar análise | 5 | Planejado (Sprint 5 — planejamento documentado na branch feat/sprint-5-resumes) |

> **Sprint 5 (em planejamento):** branch de trabalho `feat/sprint-5-resumes`,
> criada a partir de `46f4e8a` e ainda sem commits. Escopo previsto: KAN-40 a
> KAN-43 — currículos versionados e ATS determinístico (`resumes`,
> `resume_versions` (append-only) e `ats_analyses`; motor puro em
> `src/modules/ats/engine/`; rotas `/v1/resumes`, `/v1/resumes/:id/versions`,
> `/v1/resume-versions/:id`, `/analyze` e `/analysis`). O planejamento está
> documentado em [`docs/sprints/sprint-05.md`](sprints/sprint-05.md) e
> [`docs/adr/0005-sprint-5-resumes-ats.md`](adr/0005-sprint-5-resumes-ats.md).
> **Nada foi implementado ainda** — sem código, rotas, entidades, migration ou
> testes. Export JSON/HTML fica para a Sprint 6 (KAN-50/51).

### E5 — Export e dashboard

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-50 | Exportar currículo em JSON | 6 | Planejado |
| KAN-51 | Exportar currículo em HTML | 6 | Planejado |
| KAN-52 | CRUD de entrevistas | 6 | Planejado |
| KAN-53 | Dashboard de funil | 6 | Planejado |
| KAN-54 | Dashboard de compensação | 6 | Planejado |

### E6 — Hardening

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-60 | Seed de demonstração | 7 | Planejado |
| KAN-61 | CodeQL, Dependabot e Sentry | 7 | Planejado |
| KAN-62 | README de portfólio | 7 | Planejado |
| KAN-63 | Release v1.0.0 | 7 | Planejado |
