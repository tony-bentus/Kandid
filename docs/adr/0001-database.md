# ADR 0001 — Banco de dados do Kandid

- Status: Proposed (decisão pendente do spike do Sprint 0)
- Data: 2026-11-05
- Decisores: Antônio + time Kandid

## Contexto

O scaffold atual usa NestJS 12 + TypeORM + MySQL (`mysql2`). O projeto é um
portfólio e precisa de um banco gratuito para o ambiente demo, acessível pelo
runner do GitHub Actions e pelo Render.

Restrições:

- free tier sustentável para portfólio;
- conexão TLS a partir de runner e do Render;
- compatibilidade com TypeORM;
- limite de conexões compatível com um serviço free;
- setup simples o suficiente para não consumir a sprint.

## Alternativas consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **TiDB Cloud Serverless** (MySQL-compatible) | zero mudança no scaffold; TLS; free generoso; SQL compatível | limites de conexão; comportamento de suspend; ecossistema menor |
| **Aiven for MySQL** | MySQL gerenciado; TLS | plano free pequeno; pode exigir cartão |
| **Neon** (Postgres) | free tier confortável e estável; branching | exige trocar driver, migrations, enums, `bigint`, `jsonb`, `uuid` |
| **MySQL local apenas** | simples e offline | não serve para demo público nem para CI/CD real |

## Critérios de avaliação

1. Setup completo em menos de 1 dia.
2. Conexão do GitHub Actions e do Render funcionando com TLS.
3. `npm run migration:run` e `npm run test:e2e` passando contra o banco.
4. Sem estouro de conexões com pool `max: 5`.
5. Custo zero real (sem cartão obrigatório, se possível).

## Spike

Tempo máximo: 1 dia.

1. Criar instância TiDB Cloud Serverless e tentar rodar a aplicação e as migrations.
2. Se falhar em qualquer critério 2–4, criar Neon e repetir com Postgres.
3. Registrar tempo de setup, erros encontrados e decisão.

## Decisão

**Pendente.** Recomendação inicial: manter **MySQL + TiDB Cloud Serverless**.
Migrar para Postgres somente se o spike falhar em critério objetivo.

## Consequências

### Se TiDB

- Nenhuma mudança no código do Sprint 0.
- Monitorar conexões e suspensão idle.

### Se Neon (Postgres)

- Trocar `mysql2` por `pg` e `type: 'postgres'`.
- Revisar migrations (enums nativos, `jsonb`, `timestamp`, `bigint` como string).
- Adicionar transformer para `bigint` em dinheiro.
- Atualizar `docker-compose.yml`, CI e runbook.

## Ações decorrentes

- [ ] Executar o spike.
- [ ] Atualizar este ADR para `Accepted`.
- [ ] Configurar `DATABASE_URL` e `DB_SSL=true` nos secrets.
