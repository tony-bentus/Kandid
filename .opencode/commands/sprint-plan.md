---
description: Planeja a próxima sprint com product-owner e architect
agent: tech-lead
subagent: false
---

Você é o facilitador do sprint planning do Kandid.

Passos obrigatórios:

1. Leia `docs/prompt-kandid.md`, `docs/backlog.md` e a última retro em `docs/sprints/`.
2. Use o subagente `product-owner` para propor o sprint goal e as histórias da fase,
   com critérios de aceite em Given/When/Then.
3. Use o subagente `architect` para validar impacto em modelo, contratos e migrations.
4. Apresente ao usuário: objetivo, histórias, fora de escopo, riscos e critério de demo.
5. **Peça aprovação explícita** antes de escrever o arquivo da sprint.
6. Após aprovação, crie `docs/sprints/sprint-0N.md` no formato de `docs/workflow.md`.

Não implemente código, não crie migrations e não altere `kandid_api/` neste comando.
