# Sprint 0 — Fundação, agentes e CI/CD

- Status: Em andamento
- Início: 2026-11-05
- Encerramento: quando o Definition of Done for atingido

## Objetivo

Colocar de pé o **walking skeleton**: repositório organizado, time de agentes
configurado, aplicação com configuração validada, health check, banco versionado,
CI verde e deploy automático em um ambiente demo.

## Escopo

### Histórias

| ID | História |
|---|---|
| KAN-1 | Reestruturar repositório em monorepo na raiz |
| KAN-2 | Configurar agentes, comandos e permissões |
| KAN-3 | Configurar env, TypeORM, migrations e Docker Compose |
| KAN-4 | Adicionar Swagger, validação global e filtro de erros |
| KAN-5 | Criar `GET /v1/health` |
| KAN-6 | CI com lint, build, testes e MySQL |
| KAN-7 | CD para o ambiente demo |
| KAN-8 | Spike e ADR de banco de dados |

### Fora de escopo

- Autenticação e entidades de domínio (Sprint 1+).
- Currículo, ATS, dashboard.
- Ambiente de produção separado.
- Escolha definitiva do provedor de banco (só o ADR com a decisão).

## Critérios de aceite

- Dado que clono o repositório, quando executo o setup documentado, então a API sobe localmente.
- Dado que chamo `GET /v1/health`, então recebo 200 com status da aplicação e do banco.
- Dado que abro `/docs`, então vejo a documentação OpenAPI.
- Dado um PR, quando o CI roda, então lint, build, testes unitários e e2e passam.
- Dado um merge na `main`, então a imagem é publicada no GHCR e o demo é atualizado.
- Dado o ambiente demo, quando chamo `/v1/health`, então recebo 200.
- Dado o ADR 0001, então há uma recomendação de banco com critérios verificáveis.

## Demo

```bash
# local
cd kandid_api
docker compose up -d
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev

curl http://localhost:3000/v1
curl http://localhost:3000/v1/health
# abrir http://localhost:3000/docs

# remoto
curl https://<demo-url>/v1/health
```

## Validação local (2026-11-05)

| Comando | Resultado |
|---|---|
| `npm run lint` | verde, sem warnings |
| `npm run build` | verde |
| `npm test` | 4 arquivos, 14 testes |
| `npm run test:cov` | 93,75% statements/lines, 83,05% branches, 100% functions |
| `npm run migration:run` | conecta no MySQL e registra a tabela `migrations` |
| `npm run test:e2e` | 1 arquivo, 3 testes |
| `GET /v1` | 200 com metadados |
| `GET /v1/health` | 200 com `database: up` |
| `GET /docs` | 200 com Swagger UI |
| `docker build` + execução | imagem conecta ao MySQL e responde `/v1/health` com `database: up` |

## Tarefas manuais (humanas)

- [ ] Criar repositório no GitHub e configurar o remote.
- [ ] Proteger a branch `main` (PR obrigatório + checks `lint`, `test`, `build`).
- [ ] Criar o ambiente `demo` no GitHub.
- [ ] Criar o serviço no Render e configurar as variáveis.
- [ ] Tornar o pacote GHCR público ou configurar credenciais de registry no Render.
- [ ] Definir o handle real em `.github/CODEOWNERS`.
- [ ] Criar o banco no provedor escolhido (TiDB ou Neon) e liberar acesso do runner.
- [ ] Cadastrar secrets: `DATABASE_URL`, `JWT_SECRET`, `RENDER_DEPLOY_HOOK_URL`; variable `DEMO_URL`.
- [ ] Configurar health check do Render em `/v1/health`.

## Riscos

| Risco | Mitigação |
|---|---|
| Free tier do Render hiberna | health check + ping do UptimeRobot |
| Limite de conexões do banco free | pool máximo 5 e conexão TLS |
| Migrations rodando em momento errado | job separado antes do deploy, forward-only |
| CI lento | cache do npm e `concurrency` cancelando execuções antigas |
| `npm audit` acusa 2 moderadas em `@nestjs/cli` (dev-only) | sem correção compatível com Nest 12; não afeta a imagem de produção (`npm prune --omit=dev`) |
| Repositório privado estourar minutos | manter público (portfólio) |

## Definition of Done

- [x] Estrutura de repositório definida e versionada.
- [x] `opencode.jsonc`, 8 agentes e 6 comandos funcionando.
- [x] Config validada, TypeORM com `synchronize: false` e CLI de migration validada
      (a primeira migration nasce com as entidades da Sprint 1).
- [x] Swagger, validação global e filtro de erros.
- [x] `GET /v1/health` local.
- [ ] CI verde em PR (workflows criados; falta o repositório remoto).
- [ ] Deploy automático no demo após merge.
- [x] ADR 0001 de banco registrado como `Proposed` (spike depende de conta externa).
- [x] README com setup e arquitetura.
- [ ] Tarefas manuais concluídas e validadas.
