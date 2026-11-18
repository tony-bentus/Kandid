# Backlog — Kandid

Status: `Planejado` | `Em andamento` | `Implementado localmente` | `Concluído` | `Bloqueado`

> Decisão API-first (2026-11-09): o desenvolvimento segue com MySQL local via Docker; deploy (KAN-7) e banco remoto (KAN-8) foram adiados conscientemente e retomam após o fechamento local da Sprint 4.

## Épicos

| ID | Épico | Sprint | Status |
|---|---|---|---|
| E0 | Fundação, agentes e CI/CD | 0 | Concluído localmente (deploy adiado) |
| E1 | Autenticação e perfil | 1–2 | Sprint 2 concluída localmente; Sprint 1 aguarda PR/revisão |
| E2 | Empresas, recrutadores e vagas | 3 | Implementada localmente (demo/testes/commit pendentes) |
| E3 | Candidaturas e máquina de estados | 4 | Implementada localmente (demo/testes/commit pendentes) |
| E4 | Currículos e motor ATS | 5 | Planejado |
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
| KAN-7 | CD para o ambiente demo | Adiado (retoma após o fechamento local da Sprint 4) |
| KAN-8 | Spike e ADR de banco de dados | Adiado (retoma após o fechamento local da Sprint 4) |

### E1 — Autenticação e perfil

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-10 | Registrar usuário | 1 | Em andamento (PR pendente) |
| KAN-11 | Autenticar com JWT | 1 | Em andamento (PR pendente) |
| KAN-12 | Consultar usuário autenticado | 1 | Em andamento (PR pendente) |
| KAN-13 | Criar e atualizar perfil | 2 | Concluído (validado localmente; commit/push pendentes) |
| KAN-14 | CRUD de experiências e bullets | 2 | Concluído (validado localmente; commit/push pendentes) |
| KAN-15 | Catálogo e vínculo de skills | 2 | Concluído (validado localmente; commit/push pendentes) |
| KAN-16 | Formação, certificações e idiomas | 2 | Concluído (validado localmente; risco de corrida de idioma registrado) |

> Sprint 2 (KAN-13 a KAN-16) implementada e validada localmente em 2026-11-18, na
> branch `feat/sprint-2-profile` (HEAD `00b0647`): lint/build/tsc verdes, 232/232
> testes unitários e 192/192 e2e, migration sem pendências. O catálogo de skills é
> semeado por `npm run seed:skills` (118 skills, 84 aliases), de forma local e
> explícita — nunca em bootstrap ou migration. Commit, push, PR e revisão humana
> permanecem pendentes; os workflows de CD e Dependabot seguem ativos e sem
> alteração, como pendência registrada. Detalhes em
> [`docs/sprints/sprint-02.md`](sprints/sprint-02.md) e
> [`ADR 0002`](adr/0002-sprint-2-profile.md).

### E2 — Pipeline

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-20 | CRUD de empresas | 3 | Implementado localmente (Sprint 3; demo/testes/commit pendentes) |
| KAN-21 | CRUD de recrutadores | 3 | Implementado localmente (Sprint 3; demo/testes/commit pendentes) |
| KAN-22 | CRUD de vagas com stack e faixa | 3 | Implementado localmente (Sprint 3; demo/testes/commit pendentes) |

> Sprint 3 (KAN-20 a KAN-22) implementada localmente em 2026-11-18, na mesma
> branch `feat/sprint-2-profile` (HEAD `00b0647`, sem commit): CRUD de empresas,
> recrutadores e vagas com stack, senioridade, faixa salarial, filtros e
> paginação. `lint`, `tsc` e `build` verdes; migration
> `1794960000000-CreatePipelineDomain` aplicada, revertida e reaplicada com
> `schema:log` sem drift. Testes unitários/e2e, demo manual, commit, push e PR
> ficam com o humano. Decisões e contratos em
> [`docs/sprints/sprint-03.md`](sprints/sprint-03.md) e
> [`ADR 0003`](adr/0003-sprint-3-pipeline.md).

### E3 — Candidaturas

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-30 | Criar candidatura para vaga | 4 | Implementado localmente (Sprint 4; demo/testes/commit pendentes) |
| KAN-31 | Transicionar status com histórico | 4 | Implementado localmente (Sprint 4; demo/testes/commit pendentes) |
| KAN-32 | Registrar valores proposto e ofertado | 4 | Implementado localmente (Sprint 4; demo/testes/commit pendentes) |
| KAN-33 | Filtrar e paginar candidaturas | 4 | Implementado localmente (Sprint 4; demo/testes/commit pendentes) |

> Sprint 4 (KAN-30 a KAN-33) implementada localmente em 2026-11-18, na mesma
> branch `feat/sprint-2-profile` (HEAD `00b0647`, sem commit, push, PR, merge,
> release ou deploy): enum `ApplicationStatus` e `APPLICATION_TRANSITIONS`,
> entidades `Application` e `ApplicationStatusHistory` (tabela
> `application_status_history`, no singular), DTOs, serviço transacional, 6 rotas
> em `/v1` com Swagger, migration `1795046400000-CreateApplicationsDomain` e
> `DELETE /v1/jobs/:id` → 409 quando há candidatura. `GET /v1/applications`
> filtra por `status`, `companyId`, `from`, `to`, `page` e `limit`, responde com
> envelope `{ data, meta }` e rejeita `sort` com 400. Validação local: lint
> (`npm run lint`) exit 0 (1 warning preexistente em `test/auth.e2e-spec.ts:232`),
> checagem de tipos (`npx tsc --noEmit`) e build (`npm run build`) exit 0,
> `git diff --check` exit 0, migration aplicada, revertida e reaplicada,
> `migration:show` com 4 aplicadas. O `schema:log` via CLI direto
> (`npm run typeorm -- schema:log -d src/database/data-source.ts`) ficou sem
> drift. Testes unitários/e2e, demo manual e commit ficam com o humano.
> Detalhes em
> [`docs/sprints/sprint-04.md`](sprints/sprint-04.md) e
> [`ADR 0004`](adr/0004-sprint-4-applications.md).

### E4 — Currículo e ATS

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-40 | Criar currículo e gerar versão | 5 | Planejado |
| KAN-41 | Extrair keywords da vaga | 5 | Planejado |
| KAN-42 | Calcular score e checks | 5 | Planejado |
| KAN-43 | Persistir e consultar análise | 5 | Planejado |

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
