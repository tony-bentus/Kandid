---
description: Prepara o release do Kandid e documenta o deploy
agent: devops-engineer
subagent: false
---

Prepare o release $ARGUMENTS.

1. Verifique se `npm run lint`, `npm run build`, `npm test` e `npm run test:e2e` passam.
2. Confirme que as migrations estão versionadas e forward-only.
3. Revise `.github/workflows/ci.yml` e `cd.yml` para a versão alvo.
4. Atualize `docs/runbook-deploy.md` com o que mudou.
5. Liste os passos manuais que o humano precisa executar (tag, aprovação, deploy).
6. **Não** crie tag, não faça push, não dispare deploy e não rode migration remota.

Entregue o runbook e aguarde aprovação humana.
