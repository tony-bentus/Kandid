# Kandid — instruções do projeto

## Visão geral

Kandid é uma API REST em NestJS para gestão de busca por emprego: perfil estruturado,
currículos com versões, análise ATS determinística e pipeline de candidaturas.
Projeto pessoal de estudo e portfólio. A especificação completa está em
`docs/prompt-kandid.md` e é a fonte da verdade do domínio.

## Estrutura do repositório

```text
.github/          CI/CD, CodeQL, Dependabot
.opencode/        agentes e comandos do time
docs/             spec, backlog, sprints, ADRs e runbooks
kandid_api/       aplicação NestJS
```

## Comandos

Execute sempre dentro de `kandid_api/`:

```bash
npm ci
npm run start:dev
npm run lint
npm run build
npm test
npm run test:cov
npm run test:e2e
npm run migration:run
npm run migration:generate -- src/database/migrations/NomeDaMigration
```

O MySQL local sobe com `docker compose up -d` dentro de `kandid_api/`.

## Time de agentes

O fluxo completo está em `docs/workflow.md`.

- `tech-lead` (primário) orquestra e delega.
- `product-owner` define histórias e critérios de aceite.
- `architect` cuida de modelo, contratos e ADRs.
- `backend-dev` implementa.
- `qa-engineer` testa.
- `code-reviewer` revisa sem editar.
- `devops-engineer` cuida de Docker, CI e CD.
- `tech-writer` cuida de README e docs.

## Regras de trabalho

1. Toda feature começa por uma história em `docs/sprints/` com critérios Given/When/Then.
2. Implementação segue TDD quando aplicável.
3. Nenhum agente faz `git push`, merge, release, deploy ou migration em ambiente remoto.
4. Pare e peça aprovação humana antes de commit.
5. Trabalhe em branches curtas: `feat/KAN-12-descricao`, `fix/...`, `docs/...`.
6. Commits seguem Conventional Commits.
7. PRs precisam de CI verde e revisão humana.

## Convenções técnicas

- ESM: todo import relativo termina em `.js`; nunca use `require()`.
- TypeScript strict; evite `any`.
- Validação com `class-validator` e DTOs.
- Dinheiro em centavos (`bigint`), sempre com `currency` e `salary_period`.
- `resume_version` e `application_status_history` são imutáveis.
- Migrations versionadas; `synchronize: false`.
- Nenhum segredo no código. `.env` é proibido para leitura por agentes.
- Swagger em `/docs`; API com prefixo `/v1`.

## Qualidade

Antes de concluir qualquer tarefa:

```bash
npm run lint
npm run build
npm test
```

`npm run test:e2e` exige MySQL (Docker local ou service container no CI).
