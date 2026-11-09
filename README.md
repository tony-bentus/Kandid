# Kandid

**API REST para organizar a busca por emprego: perfil estruturado, currículos versionados, análise ATS determinística e pipeline de candidaturas.**

![NestJS](https://img.shields.io/badge/NestJS-12-E0234E)
![Node.js](https://img.shields.io/badge/Node.js-24-339933)
![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1)
![Status](https://img.shields.io/badge/status-Sprint_1-yellow)

## Visão geral

Quem procura emprego costuma espalhar informações entre planilhas, currículos em
pastas, e-mails e anotações. O resultado é perda de contexto, versões conflitantes
de currículo e pouca visibilidade sobre o que está funcionando no processo.

O Kandid propõe centralizar esse fluxo em uma única API:

- perfil profissional estruturado, com experiências, skills, formação,
  certificações e idiomas;
- currículos com versões imutáveis, geradas a partir do perfil;
- análise de aderência a uma vaga com motor ATS determinístico e explicável;
- candidaturas com status, histórico auditável, entrevistas e valores
  propostos/ofertados;
- métricas de funil e de compensação.

É um projeto **pessoal, de estudo e portfólio**, sem objetivo comercial. A
especificação completa do domínio está em [`docs/prompt-kandid.md`](docs/prompt-kandid.md).

> **Estado atual:** o projeto está na Sprint 1 (autenticação). Já existem a
> aplicação NestJS, a conexão com MySQL, o health check, o Swagger e as rotas de
> registro, login e usuário autenticado. Os demais domínios (perfil, vagas,
> candidaturas, currículos e ATS) ainda não foram implementados. O deploy do
> ambiente demo foi conscientemente adiado para priorizar a API; consulte
> [Status atual](#status-atual-sprint-1) e [Roadmap](#roadmap-por-sprints).

## Escopo do MVP

O escopo abaixo é o alvo do MVP definido na spec. A implementação é incremental,
por sprint.

### Dentro do escopo

- Autenticação simples com JWT: registro, login e `GET /me`.
- Perfil, experiências com bullets, skills, formação, certificações e idiomas.
- Empresas (cliente ou agência), recrutadores e vagas.
- Candidaturas com máquina de estados, histórico append-only e entrevistas.
- Currículos com versões imutáveis em snapshot JSON.
- Motor ATS determinístico, sem IA, com score e breakdown explicáveis.
- Export do currículo em JSON e HTML.
- Dashboard com funil, taxa de resposta e comparativo proposto × ofertado.
- Seed do catálogo de skills e seed de demonstração.
- Swagger, migrations, Docker Compose e documentação.

### Fora de escopo

- Geração de PDF ou DOCX.
- Integração com LLM ou qualquer recurso de IA.
- Billing, planos, multi-tenant, convites ou times.
- Upload e armazenamento de arquivos.
- Importação de currículo existente.
- Parsing automático de vaga por URL.
- Roles e permissões além de "usuário autenticado".
- Telemetria da aplicação.

## Stack e decisões técnicas

| Camada | Escolha |
|---|---|
| Runtime | Node.js 24 (CI e imagem Docker) |
| Framework | NestJS 12 |
| Linguagem | TypeScript strict, ESM (`"type": "module"`, imports relativos com `.js`) |
| Persistência | TypeORM 1.1.2 com driver `mysql2` |
| Banco | MySQL 8.4 (Docker Compose local e service container no CI) |
| Documentação | Swagger/OpenAPI em `/docs` |
| Validação | `class-validator` + `class-transformer` com `ValidationPipe` global |
| Testes | Vitest + supertest |
| Qualidade | oxlint type-aware + Prettier |
| Entrega | Docker multi-stage, GHCR, GitHub Actions e Render (demo pendente) |

Decisões que moldam o código:

- **ESM**: todo import relativo termina em `.js`; não há `require()`.
- **Prefixo global `/v1`**: a API fica em `/v1`; o Swagger fica em `/docs`.
- **Schema versionado**: `synchronize: false` e migrations versionadas. Em
  ambiente remoto, migrations são forward-only.
- **Configuração validada no boot**: o `ConfigModule` valida as variáveis de
  ambiente e falha cedo se algo estiver incorreto. `DATABASE_URL` tem prioridade
  sobre `DB_*`, e `JWT_SECRET` precisa ter pelo menos 16 caracteres.
- **Erros com formato único**: `{ statusCode, error, message, path, timestamp }`
  via filtro global de exceções.
- **Domínio escopado por usuário**: toda consulta de domínio deve usar o
  `user_id` do usuário autenticado; `user_id` nunca é aceito no body.
- **Dinheiro em centavos**: valores monetários usam `bigint`, sempre acompanhados
  de `currency` e `salary_period`.
- **Imutabilidade**: `resume_version` e `application_status_history` não sofrem
  `UPDATE`; versões e histórico são registros append-only.
- **ATS determinístico**: o score é calculado por regras explícitas e testáveis,
  com pesos, checks estruturais e keywords encontradas/ausentes. Não há IA.

## Arquitetura

Monólito modular em NestJS. Hoje a aplicação tem a fundação e a autenticação:

- `main.ts` configura o prefixo `/v1`, o `ValidationPipe`, CORS, o Swagger e a
  porta;
- `app.module.ts` carrega configuração validada, TypeORM, health, users e auth;
- `database/data-source.ts` é o `DataSource` usado pelo CLI do TypeORM, com
  entidades e migrations carregadas por glob;
- `database/migrations/1794182400000-CreateUsers.ts` cria a tabela `users`;
- `health` executa `SELECT 1` para reportar o estado do banco;
- `modules/users` contém a entidade `User` (tabela `users`) e o `UsersService`;
- `modules/auth` contém `AuthController`, `AuthService`, DTOs e a emissão de JWT;
- `common/filters` concentra o filtro global de erros;
- `common/guards` tem o `JwtAuthGuard`, implementado sem passport;
- `common/decorators` tem o `@CurrentUser()`;
- `common/interfaces` define o usuário autenticado;
- `common/utils` concentra a normalização de e-mail.

Novos módulos seguem o padrão `dto/`, `entities/`, `*.module.ts`,
`*.controller.ts`, `*.service.ts` e `*.spec.ts`.

```text
Kandid/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── cd.yml
│   │   └── codeql.yml
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── pull_request_template.md
├── .opencode/
│   ├── agents/                  # 8 agentes do time
│   └── commands/                # /sprint-plan, /feature, /test, /review, /release, /retro
├── docs/
│   ├── adr/
│   │   └── 0001-database.md
│   ├── sprints/
│   │   ├── sprint-00.md
│   │   └── sprint-01.md
│   ├── backlog.md
│   ├── prompt-kandid.md         # spec e fonte da verdade do domínio
│   ├── runbook-deploy.md
│   └── workflow.md
├── kandid_api/
│   ├── src/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interfaces/
│   │   │   └── utils/
│   │   ├── config/
│   │   ├── database/
│   │   │   ├── data-source.ts
│   │   │   └── migrations/
│   │   │       └── 1794182400000-CreateUsers.ts
│   │   ├── health/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── dto/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── auth.service.ts
│   │   │   └── users/
│   │   │       ├── entities/
│   │   │       ├── users.module.ts
│   │   │       └── users.service.ts
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   └── vitest.config*.ts
├── AGENTS.md
├── README.md
└── opencode.jsonc
```

### Modelo de domínio alvo

Visão simplificada do modelo definido na spec. A entidade `USER` já existe na
tabela `users`; `PROFILE` e as demais entidades ainda serão implementadas nas
próximas sprints.

```mermaid
erDiagram
  USER ||--|| PROFILE : possui
  USER ||--o{ COMPANY : cadastra
  USER ||--o{ RECRUITER : cadastra
  USER ||--o{ JOB : acompanha
  USER ||--o{ RESUME : cria
  PROFILE ||--o{ EXPERIENCE : tem
  PROFILE ||--o{ PROFILE_SKILL : declara
  SKILL ||--o{ PROFILE_SKILL : compõe
  COMPANY ||--o{ JOB : origem
  COMPANY ||--o{ RECRUITER : agencia
  JOB ||--o{ APPLICATION : recebe
  APPLICATION ||--o{ APPLICATION_STATUS_HISTORY : audita
  APPLICATION ||--o{ INTERVIEW : agenda
  RESUME ||--o{ RESUME_VERSION : versiona
  RESUME_VERSION ||--o{ ATS_ANALYSIS : analisa
```

## Como rodar localmente

Pré-requisitos:

- Node.js 24 e npm;
- Docker com Docker Compose.

Execute a partir de `kandid_api/`:

```bash
cd kandid_api
docker compose up -d
docker compose ps          # aguarde o MySQL ficar healthy
cp .env.example .env
# edite .env e troque JWT_SECRET por um valor aleatório com 16+ caracteres
npm ci
npm run migration:run
npm run start:dev
```

No Windows/PowerShell, o equivalente ao `cp` é:

```powershell
Copy-Item .env.example .env
```

O `docker-compose.yml` sobe MySQL 8.4 em `localhost:3306`, com banco `kandid` e
usuário/senha `kandid`. Essas credenciais são apenas para desenvolvimento local.

O `npm run migration:run` aplica a migration `1794182400000-CreateUsers`, que
cria a tabela `users`. O TypeORM também mantém a tabela de controle `migrations`.

URLs locais:

| URL | O que é |
|---|---|
| http://localhost:3000/v1 | Metadados da API |
| http://localhost:3000/v1/health | Saúde da aplicação e do banco |
| http://localhost:3000/docs | Swagger UI |

Para parar o banco:

```bash
docker compose down
# use "docker compose down -v" para apagar também o volume local
```

## Endpoints disponíveis

Esta tabela reflete o estado atual do código. As rotas de autenticação estão
implementadas; os demais domínios ainda não.

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/v1` | Pública | Metadados: nome, versão e links de documentação e health |
| `GET` | `/v1/health` | Pública | Status da aplicação, versão, uptime e conexão com o banco |
| `POST` | `/v1/auth/register` | Pública | Cria a conta e devolve `{ user, accessToken }` |
| `POST` | `/v1/auth/login` | Pública | Autentica com e-mail e senha e devolve `{ user, accessToken }` |
| `GET` | `/v1/auth/me` | Bearer JWT | Devolve o usuário autenticado pelo token |
| `GET` | `/docs` | Pública | Swagger UI (não faz parte do prefixo `/v1`) |

### Exemplos com `curl`

Metadados:

```bash
curl -s http://localhost:3000/v1
```

```json
{
  "name": "Kandid API",
  "version": "0.1.0",
  "docs": "/docs",
  "health": "/v1/health"
}
```

Health:

```bash
curl -s http://localhost:3000/v1/health
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": "2026-11-05T12:00:00.000Z",
  "uptime": 42,
  "services": {
    "database": "up"
  }
}
```

`timestamp` e `uptime` variam a cada chamada. Se o banco não responder, a resposta
continua com HTTP 200, mas com `status: "degraded"` e `services.database: "down"`.

Swagger:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/docs
# 200
```

Registrar usuário:

```bash
curl -s -X POST http://localhost:3000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana.souza@example.com","password":"senha-segura-123"}'
```

```json
{
  "user": {
    "id": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
    "name": "Ana Souza",
    "email": "ana.souza@example.com",
    "createdAt": "2026-11-09T13:20:41.000Z",
    "updatedAt": "2026-11-09T13:20:41.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Login e extração do token (requer `jq`):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.souza@example.com","password":"senha-segura-123"}' \
  | jq -r '.accessToken')
```

O corpo de sucesso do login é o mesmo envelope `{ user, accessToken }` do
register.

Usuário autenticado:

```bash
curl -s http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "id": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
  "name": "Ana Souza",
  "email": "ana.souza@example.com",
  "createdAt": "2026-11-09T13:20:41.000Z",
  "updatedAt": "2026-11-09T13:20:41.000Z"
}
```

E-mail duplicado (409):

```bash
curl -s -X POST http://localhost:3000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Souza","email":"ana.souza@example.com","password":"senha-segura-123"}'
```

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Email already registered",
  "path": "/v1/auth/register",
  "timestamp": "2026-11-09T13:21:02.000Z"
}
```

Login inválido (401), com a mesma resposta para e-mail inexistente e senha errada:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana.souza@example.com","password":"senha-errada"}'
# 401
```

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "path": "/v1/auth/login",
  "timestamp": "2026-11-09T13:21:02.000Z"
}
```

`GET /v1/auth/me` sem token também responde 401, com
`Invalid or missing access token`.

## Scripts npm

Execute todos dentro de `kandid_api/`.

| Script | O que faz |
|---|---|
| `npm run build` | Compila a aplicação com `nest build` |
| `npm run start` | Sobe a aplicação sem watch |
| `npm run start:dev` | Sobe em modo watch |
| `npm run start:debug` | Sobe em modo debug com watch |
| `npm run start:prod` | Executa `node dist/main.js` |
| `npm run lint` | Roda oxlint type-aware em `src/` e `test/` |
| `npm run format` | Formata com Prettier |
| `npm test` | Roda os testes unitários com Vitest |
| `npm run test:watch` | Roda testes unitários em watch |
| `npm run test:cov` | Roda testes unitários com cobertura |
| `npm run test:e2e` | Roda os testes e2e com Vitest e supertest |
| `npm run migration:generate -- src/database/migrations/Nome` | Gera uma migration a partir das entidades |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:show` | Lista migrations e status |
| `npm run migration:revert` | Reverte a última migration (apenas local) |

Quando o CD for retomado, o deploy do ambiente demo será feito pelo workflow
`cd.yml`, não por um script npm.

## Testes e qualidade

Os testes usam Vitest com globals e supertest:

| Suíte | Arquivo | Testes atuais |
|---|---|---|
| Unitário — metadados | `src/app.controller.spec.ts` | 1 |
| Unitário — health | `src/health/health.controller.spec.ts` | 2 |
| Unitário — validação de env | `src/config/env.validation.spec.ts` | 8 |
| Unitário — filtro de erros | `src/common/filters/all-exceptions.filter.spec.ts` | 3 |
| Unitário — auth service | `src/modules/auth/auth.service.spec.ts` | 8 |
| Unitário — users service | `src/modules/users/users.service.spec.ts` | 4 |
| Unitário — guard JWT | `src/common/guards/jwt-auth.guard.spec.ts` | 11 |
| Unitário — DTOs de auth | `src/modules/auth/dto/auth.dto.spec.ts` | 13 |
| **Total unitário** | **8 arquivos** | **50** |
| E2E — auth | `test/auth.e2e-spec.ts` | 25 |
| E2E — API, health e erro | `test/app.e2e-spec.ts` | 3 |
| **Total e2e** | **2 arquivos** | **28** |

Os testes unitários cobrem os arquivos `*.spec.ts`. Os testes e2e usam
`*.e2e-spec.ts` e exigem um MySQL acessível: Docker Compose local ou o service
container do CI.

> **Limitação no Windows:** `npm run lint` usa `oxlint --type-aware` e, nesta
> máquina, o AppLocker/WDAC bloqueia a execução de
> `@oxlint-tsgolint/win32-x64/tsgolint.exe`. O fallback usado foi
> `npx oxlint src/ test/` + `npx tsc --noEmit`; o CI em Ubuntu executa o comando
> completo.

Comandos de verificação:

```bash
cd kandid_api
npm run lint
npm run build
npm test
npm run test:cov
npm run test:e2e   # exige MySQL
```

O CI roda `lint`, `build`, `test`, `coverage` e `e2e` em jobs separados. O `e2e`
executa `npm run migration:run` antes dos testes, com MySQL 8.4 como service
container.

## CI/CD e deploy

| Workflow | Gatilho | O que faz |
|---|---|---|
| `ci.yml` | Pull request para `main` e push na `main` | Jobs `lint`, `build`, `test`, `coverage` e `e2e` com Node.js 24 e cache do npm |
| `codeql.yml` | Push/PR na `main` e cron semanal | Análise CodeQL para `javascript-typescript` |
| `cd.yml` | Push na `main`, tag `v*` e `workflow_dispatch` | Build/push da imagem no GHCR, migration, deploy hook do Render e health check |
| `dependabot.yml` | Semanal | Atualizações de npm, GitHub Actions e Docker |

```mermaid
flowchart LR
  PR[Pull request] --> CI[CI: lint, build, test, coverage, e2e]
  CI -->|merge na main| CD[CD]
  CD --> IMG[Build e push da imagem no GHCR]
  CD --> MIG[Job de migration]
  IMG --> DEPLOY[Deploy hook do Render]
  MIG --> DEPLOY
  DEPLOY --> HC[Health check em DEMO_URL/v1/health]
  HC --> OK[Demo atualizado]
  HC --> FAIL[Falha após 20 tentativas]
```

**CD temporariamente desativado.** Por decisão de priorizar a entrega da API, o
deploy do ambiente demo e a escolha do banco remoto (KAN-7 e KAN-8) estão
adiados. O `cd.yml` permanece versionado como referência, mas não há ambiente
demo configurado. KAN-7 e KAN-8 voltam após a Sprint 3; até lá, o
desenvolvimento usa MySQL local via Docker.

Detalhes do workflow (para quando o CD for retomado):

- a imagem é publicada em `ghcr.io/<owner>/<repo>/kandid-api`, com tags `sha`,
  `latest` e, em releases `v*`, a versão SemVer (`<owner>/<repo>` são as
  coordenadas do repositório no GitHub);
- o job de migration usa o environment `demo`, `DATABASE_URL` e `DB_SSL=true`;
- o deploy chama `RENDER_DEPLOY_HOOK_URL` e consulta `DEMO_URL/v1/health` por até
  20 tentativas, com 15 segundos entre elas, exigindo `status: ok` e
  `services.database: up`;
- se `RENDER_DEPLOY_HOOK_URL` ou `DEMO_URL` não estiverem configurados, o workflow
  falha explicitamente.

O banco do ambiente demo também está pendente: o
[ADR 0001](docs/adr/0001-database.md) está em `Proposed` e recomenda **TiDB Cloud
Serverless** (compatível com MySQL), com fallback para **Neon/Postgres** se o
spike falhar nos critérios definidos. A decisão fica para a retomada do KAN-8.

Passos manuais e operação estão no
[runbook de deploy](docs/runbook-deploy.md). Resumo para a retomada:

- [ ] Criar o repositório no GitHub e configurar o remote.
- [ ] Proteger a `main` com PR obrigatório e checks `lint`, `build`, `test`.
- [ ] Criar o environment `demo` no GitHub.
- [ ] Criar o serviço no Render com health check em `/v1/health`.
- [ ] Criar o banco do demo e liberar acesso do runner e do Render.
- [ ] Cadastrar `DATABASE_URL`, `JWT_SECRET` e `RENDER_DEPLOY_HOOK_URL`; configurar
      a variable `DEMO_URL`.
- [ ] Validar o primeiro CI em um PR e o primeiro deploy após merge.

## Time de agentes e fluxo de trabalho

O desenvolvimento é assistido por um time de 8 agentes OpenCode, descrito em
[`docs/workflow.md`](docs/workflow.md):

| Agente | Responsabilidade |
|---|---|
| `tech-lead` | Orquestra, decompõe, delega e consolida |
| `product-owner` | Backlog, histórias e critérios de aceite |
| `architect` | Modelo, contratos, ADRs e riscos |
| `backend-dev` | Implementação e migrations |
| `qa-engineer` | Testes e validação |
| `code-reviewer` | Revisão read-only |
| `devops-engineer` | Docker, CI, CD e runbooks |
| `tech-writer` | README, ADRs e relatórios |

O ciclo de uma sprint é: escopo aprovado, build em branches curtas, testes,
revisão, validação humana, merge/deploy e retrospectiva. Os comandos disponíveis
são `/sprint-plan`, `/feature`, `/test`, `/review`, `/release` e `/retro`.

O humano aprova **escopo, commit, merge e deploy**. Nenhum agente faz `git push`,
merge, release ou deploy por conta própria. Commits seguem Conventional Commits e
branches curtas seguem o padrão `feat/KAN-12-descricao`.

## Roadmap por sprints

Sprints são fases, não calendário: cada uma fecha quando o Definition of Done é
atingido. O detalhamento está em [`docs/backlog.md`](docs/backlog.md).

| Sprint | Foco | Status |
|---|---|---|
| 0 | Fundação, agentes e CI/CD | Concluída localmente (deploy adiado) |
| 1 | Autenticação: registro, login e `GET /me` | Em andamento (PR pendente) |
| 2 | Perfil: experiências, skills, formação, certificações e idiomas | Planejado |
| 3 | Empresas, recrutadores e vagas | Planejado |
| 4 | Candidaturas e máquina de estados | Planejado |
| 5 | Currículos, versionamento e motor ATS | Planejado |
| 6 | Export JSON/HTML, entrevistas e dashboards | Planejado |
| 7 | Seed de demonstração, hardening e release `v1.0.0` | Planejado |

## Status atual (Sprint 1)

**Sprint 1 — Autenticação**, iniciada em 2026-11-09 e em andamento (PR pendente).
O objetivo é entregar a base de identidade da API: cadastro, login com JWT e
consulta do usuário autenticado.

Entregue:

- tabela `users` criada pela migration `1794182400000-CreateUsers`;
- `POST /v1/auth/register`, `POST /v1/auth/login` e `GET /v1/auth/me`;
- Argon2id com parâmetros fixos (m=19456, t=2, p=1) e e-mail normalizado;
- JWT HS256 com expiração de 1h e `JwtAuthGuard` próprio, sem passport;
- respostas de usuário sem `password_hash` e erros no formato padrão;
- testes unitários e e2e de autenticação;
- Swagger, README e backlog atualizados;
- fundação da Sprint 0 preservada (health, Swagger, CI e migrations).

A Sprint 0 está concluída localmente; o deploy do demo foi adiado.

Validação local registrada em 2026-11-09:

| Verificação | Resultado |
|---|---|
| `npm run build` | Verde |
| `npm test` | 8 arquivos, 50 testes |
| `npm run test:e2e` | 2 arquivos, 28 testes, com MySQL local via Docker e migration aplicada |
| `npx oxlint src/ test/` | Verde (fallback) |
| `npx tsc --noEmit` | Verde |
| `npm run lint` | Bloqueado nesta máquina por AppLocker/WDAC em `tsgolint.exe`; o CI em Ubuntu executa o comando completo |
| `npm run migration:run` | Aplica `1794182400000-CreateUsers` |
| Smoke test | `/v1/health` 200 com `database: up`, `/docs` 200, register/login/me funcionando e `/me` sem token 401 |

Pendências:

- **Lint completo local:** `npm run lint` type-aware bloqueado pelo ambiente
  Windows; validado por fallback (`npx oxlint` + `npx tsc --noEmit`).
- **PR e CI:** KAN-10, KAN-11 e KAN-12 estão implementadas, mas o PR e a execução
  do CI ainda dependem do repositório remoto.
- **Revisão humana:** aprovação final do PR pendente.
- **Deploy e banco remoto:** KAN-7 e KAN-8 adiados conscientemente para priorizar
  a API; retomam após a Sprint 3.
- **Proteção de branch:** configuração da `main` com PR obrigatório e checks
  pendente de configuração humana no GitHub.

## Documentação

- [`docs/prompt-kandid.md`](docs/prompt-kandid.md) — spec completa do domínio.
- [`docs/backlog.md`](docs/backlog.md) — épicos, histórias e status.
- [`docs/workflow.md`](docs/workflow.md) — time, ciclo de sprint e portões humanos.
- [`docs/sprints/sprint-00.md`](docs/sprints/sprint-00.md) — escopo e validação da
  Sprint 0.
- [`docs/sprints/sprint-01.md`](docs/sprints/sprint-01.md) — escopo, contratos e
  validação da Sprint 1.
- [`docs/adr/0001-database.md`](docs/adr/0001-database.md) — decisão de banco do
  ambiente demo.
- [`docs/runbook-deploy.md`](docs/runbook-deploy.md) — deploy, migrations e
  rollback.

## Licença e aviso

Não há arquivo `LICENSE` nem licença definida para este projeto. O
`kandid_api/package.json` declara `"private": true` e `"license": "UNLICENSED"`.

Este é um projeto pessoal de estudo e portfólio, sem objetivo comercial. Não há
concessão de licença para reutilização; entre em contato com o autor antes de usar
o código em outro projeto.
