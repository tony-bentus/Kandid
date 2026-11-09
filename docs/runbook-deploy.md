# Runbook de deploy — Kandid demo

Este documento cobre o caminho `local -> CI -> demo`. O Sprint 0 usa **um único
ambiente remoto** (`demo`). Não há produção separada.

## Visão geral

```text
PR        -> CI: lint, build, unit, migrate+e2e, coverage, CodeQL
merge main -> CD: build imagem -> GHCR -> migration -> Render deploy hook -> health check
tag v*    -> build com tag SemVer imutável (mesmo demo)
```

## Pré-requisitos

- repositório público no GitHub;
- serviço no Render (Docker) para a API;
- banco MySQL ou Postgres free (ver `docs/adr/0001-database.md`);
- conta no GHCR (usa o `GITHUB_TOKEN`, sem configuração extra).

## 1. Repositório no GitHub

```bash
git remote add origin git@github.com:<usuario>/kandid.git
git add .
git commit -m "chore: sprint 0 foundation"
git push -u origin main
```

## 2. Proteção da branch `main`

Settings → Branches → Add branch protection rule:

- [x] Require a pull request before merging
- [x] Require status checks to pass: `lint`, `build`, `test`, `coverage`, `e2e`
- [x] Require branches to be up to date
- [x] Do not allow bypassing the above settings
- [ ] Allow force pushes (deixar desmarcado)

## 3. Banco de dados

Siga o ADR 0001. Ao criar a instância:

1. Copie a connection string (`DATABASE_URL`).
2. Garanta TLS (`DB_SSL=true`).
3. Libere acesso do GitHub Actions e do Render (IP allowlist ou público com TLS).
4. Crie os bancos `kandid_demo` e, se quiser testar, `kandid_staging`.

## 4. Serviço no Render

O CD publica a imagem no GHCR; o Render consome essa imagem.

1. No GitHub, abra o pacote `kandid-api` em **Packages** e torne-o público, ou
   configure as credenciais do GHCR no Render (usuário + PAT com `read:packages`).
2. New → Web Service → Deploy from an existing image:
   `ghcr.io/<usuario>/kandid/kandid-api:latest`.
3. Health check path: `/v1/health`.
4. Variáveis de ambiente:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL` (secret)
   - `DB_SSL=true`
   - `JWT_SECRET` (secret, mínimo 16 caracteres, diferente do exemplo)
   - `CORS_ORIGIN=*`
5. Copie o **Deploy Hook** do serviço.

> Como o Render usa a imagem `:latest`, o rollback por SHA (seção Rollback) é o
> caminho seguro para voltar a uma versão anterior. O deploy hook apenas dispara
> o pull da imagem.

> O Render free hiberna após inatividade. Configure um monitor no UptimeRobot
> apontando para `/v1/health` se quiser manter o demo acordado.

## 5. Secrets e variables no GitHub

Settings → Secrets and variables → Actions:

| Tipo | Nome | Uso |
|---|---|---|
| Secret | `DATABASE_URL` | job de migration |
| Secret | `RENDER_DEPLOY_HOOK_URL` | dispara o deploy |
| Variable | `DEMO_URL` | health check pós-deploy |

O `JWT_SECRET` fica apenas no Render; o job de migration não inicializa a
aplicação. O CD usa `DB_SSL=true` fixo no workflow.

Environment `demo` (Settings → Environments): crie e, se quiser um portão extra,
adicione **Required reviewers**.

## 6. Primeiro deploy

1. Faça merge de um PR na `main`.
2. Acompanhe o workflow **CD** em Actions.
3. Verifique:
   - imagem publicada em `ghcr.io/<usuario>/kandid/kandid-api:<sha>`;
   - job de migration sem erros;
   - deploy hook retornando 2xx;
   - `curl https://<demo-url>/v1/health` retornando `status: ok` e
     `services.database: up` (o workflow valida o JSON, não só o HTTP 200).

## Release por tag

```bash
git tag v0.1.0
git push origin v0.1.0
```

A tag dispara o CD e publica a imagem com tag SemVer (`:0.1.0`), além de `:sha` e
`:latest`. O deploy continua sendo o mesmo ambiente `demo`.

## Migrations

- Rodam como job do pipeline, **antes** do deploy.
- Forward-only: nunca use `migration:revert` em ambiente remoto.
- Para criar localmente:

```bash
cd kandid_api
npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:run
```

## Rollback

O Render usa a imagem configurada no serviço. Para reverter:

1. Identifique o SHA/tag da última versão boa em GHCR.
2. No Render, altere a imagem para `ghcr.io/<usuario>/kandid/kandid-api:<sha-bom>`.
3. Dispare o deploy hook e valide `/v1/health`.
4. Abra um PR revertendo o commit problemático para realinhar `main`.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| CI falha em `test:e2e` | MySQL do service container não subiu | ver logs do serviço e health check |
| App sobe e cai | `DATABASE_URL` ou `DB_SSL` inválidos | conferir secrets e logs do Render |
| `ECONNREFUSED` no Render | banco sem acesso público/TLS | ajustar allowlist e `DB_SSL` |
| Cold start longo | Render free hibernou | monitor de uptime ou aceitar |
| Migration falha | banco inacessível ou migration destrutiva | rodar local, revisar SQL |
| 401 em tudo | `JWT_SECRET` ausente | configurar secret |

## Checklist do Sprint 0

- [ ] Repositório criado e `main` protegida
- [ ] Banco criado e acessível pelo runner
- [ ] Serviço Render criado com health check
- [ ] Secrets e variables configurados
- [ ] Environment `demo` criado
- [ ] CI verde em um PR
- [ ] Deploy automático após merge
- [ ] `/v1/health` público retornando 200 com `services.database: up`
