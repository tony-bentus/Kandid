# Fluxo de trabalho — Time Kandid

## Princípios

1. **Humano no controle**: agentes preparam, executam e reportam; o humano aprova
   escopo, commit, merge e deploy.
2. **Sprints são fases**, não calendário: abrem com escopo aprovado e fecham quando
   o Definition of Done é atingido.
3. **Trabalho pequeno**: nenhuma história passa de 2 dias; no máximo 3 em andamento.
4. **Tudo verificável**: critério de aceite vira teste; decisão vira ADR.
5. **Sem autonomia destrutiva**: nenhum agente faz `git push`, merge, release ou deploy.

## Time

| Agente | Modo | Responsabilidade |
|---|---|---|
| `tech-lead` | primary | Orquestra, decompõe, delega e consolida |
| `product-owner` | subagent | Backlog, histórias, critérios de aceite |
| `architect` | subagent | Modelo, contratos, ADRs, riscos |
| `backend-dev` | subagent | Implementação e migrations |
| `qa-engineer` | subagent | Testes e validação |
| `code-reviewer` | subagent | Revisão read-only |
| `devops-engineer` | subagent | Docker, CI, CD e runbooks |
| `tech-writer` | subagent | README, ADRs e relatórios |

## Ciclo da sprint

```text
1. SCOPE      product-owner + architect -> docs/sprints/sprint-0N.md   [aprovação humana]
2. BUILD      backend-dev em branches curtas
3. TEST       qa-engineer escreve/roda testes
4. REVIEW     code-reviewer aponta achados (read-only)
5. VALIDATE   humano testa os critérios Given/When/Then
6. SHIP       merge na main -> CI -> deploy automático no demo
7. RETRO      tech-lead + tech-writer -> docs/sprints/retro-0N.md
```

Comandos: `/sprint-plan`, `/feature`, `/test`, `/review`, `/release`, `/retro`.

## Definition of Ready

- valor descrito em uma frase;
- critérios de aceite em Given/When/Then;
- contrato de API (rota, DTO, status HTTP);
- notas de teste;
- dependências resolvidas;
- estimativa ≤ 2 dias.

## Definition of Done

- código + testes (unit/e2e conforme o caso);
- `npm run lint`, `npm run build` e `npm test` verdes;
- Swagger atualizado;
- migration versionada (se houver banco);
- PR revisado e mergeado;
- deploy no demo funcionando;
- critérios validados pelo humano.

## Git

- `main` sempre deployável; branches curtas `feat/KAN-12-descricao`.
- Conventional Commits: `feat(profile): add skill level`.
- PR com link da história, checklist e evidência.
- Squash merge, CI obrigatório, sem push direto na `main`.
- Tags SemVer por fase: `v0.1.0`, `v0.2.0`...

## Portões humanos

| Portão | Decisão |
|---|---|
| Escopo da sprint | aprovar `docs/sprints/sprint-0N.md` |
| Commit | aprovar antes de commitar |
| Merge | revisar e aprovar PR no GitHub |
| Deploy | merge na `main` (demo) ou tag (release) |

## Template de sprint

```markdown
# Sprint 0N — Título

## Objetivo
Uma frase com o resultado demonstrável.

## Escopo
### Histórias
- KAN-XX — ...
### Fora de escopo
- ...

## Critérios de aceite
- Dado ... quando ... então ...

## Demo
Passos para validar manualmente.

## Riscos
- ...

## Definition of Done
- [ ] ...
```

## CI/CD

```text
PR        -> lint, build, unit, migrate+e2e, coverage, CodeQL
main      -> build de imagem, GHCR, migration, deploy no demo, health check
tag v*    -> imagem imutável com versão SemVer
```

Detalhes operacionais em `docs/runbook-deploy.md`.
