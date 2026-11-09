---
description: Implementa uma história com TDD, testes e review
agent: tech-lead
subagent: false
---

História: $ARGUMENTS

Execute o fluxo abaixo, parando em cada portão:

1. Localize a história em `docs/sprints/`. Se não existir ou estiver ambígua,
   use `product-owner` para refiná-la e peça aprovação.
2. Use `architect` para apontar impacto em schema, contrato e migrations.
3. Use `backend-dev` para implementar em passos pequenos, com testes.
4. Use `qa-engineer` para escrever/rodar os testes dos critérios de aceite.
5. Use `code-reviewer` para revisar o diff.
6. Se houver achados bloqueantes, devolva ao `backend-dev` e repita 4–5.
7. Verifique `npm run lint`, `npm run build` e `npm test` dentro de `kandid_api/`.

**PARE aqui.** Não faça commit, push, merge nem deploy. Entregue o relatório no
formato definido em `AGENTS.md` e aguarde aprovação humana.
