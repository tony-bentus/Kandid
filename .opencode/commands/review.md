---
description: Revisa o diff atual em busca de bugs e regressões
agent: code-reviewer
subagent: false
---

Revise as mudanças atuais do Kandid.

1. Identifique o diff relevante (`git status`, `git diff`, `git diff --staged`).
2. Leia os critérios de aceite da história correspondente.
3. Avalie corretude, segurança, contratos, migrations, testes e manutenção.
4. Reporte apenas achados verificáveis, com `arquivo:linha` e sugestão.

Não edite arquivos. Não faça commit, push ou deploy.
