# AGENTS.md — kandid_api

Instruções específicas da aplicação. As regras gerais do time estão em `../AGENTS.md`
e o fluxo de trabalho em `../docs/workflow.md`.

## Escopo

API NestJS 12 + TypeORM + MySQL. ESM (`"type": "module"`): imports relativos
terminam em `.js`.

## Comandos

```bash
npm ci
docker compose up -d
cp .env.example .env
npm run migration:run
npm run start:dev
npm run lint
npm run build
npm test
npm run test:cov
npm run test:e2e
```

## Estrutura

```text
src/
  config/          ConfigModule, validação de env
  database/        DataSource, migrations, seeds (futuro)
  common/          filtros, guards, decorators, paginação
  health/          health check
  modules/         features (auth, profiles, jobs, applications, resumes, ats...)
test/              e2e
```

Cada feature module segue `dto/`, `entities/`, `*.module.ts`, `*.controller.ts`,
`*.service.ts`, `*.spec.ts`.

## Banco

- `synchronize: false`; toda mudança de schema vira migration.
- `src/database/data-source.ts` lê o `.env` para o CLI do TypeORM.
- MySQL local: `docker compose up -d`.
- `DATABASE_URL` tem prioridade sobre `DB_*` (uso em CI/demo).
- Dinheiro sempre em centavos (`bigint`) + `currency` + `salary_period`.

## Rotas e contratos

- Prefixo global `/v1`; Swagger em `/docs`.
- `GET /v1` metadados; `GET /v1/health` saúde.
- Erros no formato `{ statusCode, error, message, path, timestamp }`.
- `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted`.

## Segurança

- Nunca commitar `.env`; `.env.example` documenta as variáveis.
- `JWT_SECRET` é obrigatório e tem no mínimo 16 caracteres.
- Toda consulta de domínio deve ser escopada pelo usuário autenticado.
