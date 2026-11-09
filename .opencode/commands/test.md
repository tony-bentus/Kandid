---
description: Executa a suíte de testes e reporta falhas
agent: qa-engineer
subagent: false
---

Valide a suíte do Kandid.

1. Leia os critérios de aceite da sprint aberta em `docs/sprints/`.
2. Rode, dentro de `kandid_api/`:
   - `npm test`
   - `npm run test:cov`
   - `npm run test:e2e` (suba o MySQL com `docker compose up -d` se necessário)
3. Mapeie cada critério para o teste que o cobre.
4. Reporte falhas com passos, esperado, obtido, arquivo provável e severidade.

Não edite código de produção. Não faça commit, push ou deploy.
