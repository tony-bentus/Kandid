# Sprint 5 — Currículos e motor ATS

- Status: Planejada — aguardando implementação, testes, demo e portão humano
- Branch: `feat/sprint-5-resumes`, base `46f4e8a` (merge do PR #12). Sprints 0–4 concluídas e mergeadas em `main`
- Início: 2026-11-19 (documento de planejamento)
- Encerramento local: pendente — nenhuma implementação, validação, demo ou commit executado nesta etapa de planejamento
- Épico: E4 (`docs/backlog.md`)

## Objetivo

**Sprint goal:** permitir que o usuário autenticado transforme seu perfil em um
currículo versionado e imutável, extraia os requisitos de uma vaga e obtenha uma
análise ATS determinística, explicável e auditável, fechando a parte de currículo/ATS
da Fase 3 da spec (`docs/prompt-kandid.md:516-524`).

O motor ATS segue integralmente as etapas e os pesos da spec
(`docs/prompt-kandid.md:205-305`), e o snapshot segue o contrato imutável
(`docs/prompt-kandid.md:306-362`). Nesta sprint **não** há export JSON/HTML nem
alteração em `applications`: esses pontos estão registrados nas decisões e nas
ambiguidades abaixo.

## Escopo

### Histórias

| ID | História | Entrega principal | Estimativa |
|---|---|---|---|
| KAN-40 | Criar currículo e gerar versão | `resume`/`resume_version`, builder de snapshot a partir do perfil, versionamento transacional com `pessimistic_write`, imutabilidade, rotas de currículo e de versão | 2 dias |
| KAN-41 | Extrair keywords da vaga | `normalizer.ts` e `job-parser.ts` em `src/modules/ats/engine/`, seções obrigatórias/desejáveis, aliases, anos e senioridade | 2 dias |
| KAN-42 | Calcular score e checks | `resume-extractor.ts`, `scorer.ts` e `checks.ts`, pesos/renormalização da spec, breakdown e checks estruturais | 2 dias |
| KAN-43 | Persistir e consultar análise | `ats_analysis`, `POST /v1/resume-versions/:id/analyze`, `GET /v1/resume-versions/:id/analysis`, leitura do score na versão | 1 dia |

Definition of Ready por história: critérios Given/When/Then abaixo, contratos e
exemplos na seção Contratos, regras de negócio e modelo de dados definidos, demo
manual executável (pendente para o humano), dependências listadas e estimativa
≤ 2 dias.

### Decisões registradas (tech lead / PO)

Decisões **provisórias, mas adotadas para implementação**, sujeitas ao portão humano
da seção Pendente de validação humana/architect:

1. **Export JSON/HTML fica na Sprint 6 (KAN-50/51)**, conforme `docs/backlog.md`,
   embora a spec inclua export na Fase 3 (`docs/prompt-kandid.md:363-372,521,524`).
   Nenhuma rota `/export` é entregue ou documentada nesta sprint. Ver ambiguidade 1.
2. **A Sprint 5 não altera `applications`**: `resume_version_id` continua `null` na
   resposta; o vínculo candidatura↔versão é história separada, a decidir no portão.
   Nenhuma rota de candidatura é modificada. Ver ambiguidade 2.
3. **`resume_version` é append-only**: sem `UPDATE` e sem `DELETE`.
   `unique(resume_id, version)`; geração sob transação com `pessimistic_write` na
   linha do `resume`. Ver ambiguidade 3.
4. **Um usuário pode ter vários `resume`**; `is_default` com **no máximo um** default
   por usuário, garantido em transação. Não é obrigado a existir um default.
   Ver ambiguidade 4.
5. **`ats_analysis` permite múltiplas linhas por `(resume_version_id, job_id)`** para
   auditoria; `GET` devolve a mais recente por `created_at DESC, id ASC`. A rota de
   consulta é **`GET /v1/resume-versions/:id/analysis`**: a spec define somente o
   POST, mas o GET é necessário para KAN-43. Ver ambiguidades 5 e 6.
6. **Motor ATS em `src/modules/ats/engine/`**, com funções puras e determinísticas,
   sem IA; catálogo de skills do banco como entrada. Ver ambiguidade 7.
7. **Score com dimensionamentos e pesos exatos da spec** (35/10/20/15/10/5/5),
   renormalização quando a dimensão não for aplicável, `clamp` em `[0, 100]` e
   arredondamento para inteiro com `Math.round`. Ver ambiguidade 8.
8. **Rotas exatas desta sprint:** `POST/GET/PATCH/DELETE /v1/resumes`,
   `POST /v1/resumes/:id/versions`, `GET /v1/resume-versions/:id`,
   `POST /v1/resume-versions/:id/analyze`, `GET /v1/resume-versions/:id/analysis`.
   Sem rotas de export.
9. **Todo endpoint** com `JwtAuthGuard`, `@CurrentUser()`, escopo por `userId`,
   `ParseUUIDPipe` nos parâmetros `:id`, Swagger completo e envelope `{ data, meta }`
   na única listagem (`GET /v1/resumes`), conforme `docs/prompt-kandid.md:425-436`.
10. **Migration sugerida:** `1795737600000-CreateResumeDomain` (data 2026-11-19),
    classe `CreateResumeDomain1795737600000`. Ajustar se houver conflito de timestamp
    com outra migration, registrando a escolha no documento.

### Resolução de conflitos entre este documento, a spec e as decisões

A implementação deve seguir **esta** seção quando houver divergência:

| Tema | Decisão | Justificativa |
|---|---|---|
| Nomenclatura física das tabelas | Nomes plurais do projeto: `resumes`, `resume_versions` e `ats_analyses`; entidades TypeScript no singular (`Resume`, `ResumeVersion`, `AtsAnalysis`), decoradas com esses nomes de tabela | A spec cita `resume`, `resume_version` e `ats_analysis` como conceito no singular; a migration adota o plural de `users`, `profiles` e `applications` (`docs/adr/0004-sprint-4-applications.md:83-87`) |
| Export na Fase 3 (`spec:363-372,521,524`) | Fora da Sprint 5; KAN-50/51 na Sprint 6 | Backlog é o plano aprovado; não inventar rotas de export (decisão 1) |
| Vínculo com candidatura | Nenhuma alteração em `applications`; `resumeVersionId` segue `null` na resposta | Escopo explícito da decisão 2; história separada no portão |
| `ats_score` em `resume_version` (`spec:153,522`) vs. append-only | Coluna existe e permanece `null`; **nenhum `UPDATE`** na versão. O score vigente é lido da análise mais recente em `ats_analyses` e exposto em `GET /v1/resume-versions/:id` como campo derivado | A decisão 3 (sem `UPDATE`) prevalece; a imutabilidade não pode ser quebrada por escrita de score. Sinalizado em Riscos para o portão |
| `GET` da análise | Rota nova `GET /v1/resume-versions/:id/analysis` (decisão 5), embora a spec só liste o POST | Necessária para KAN-43 consultar o resultado persistido |
| Primeira versão | `version = 1` na primeira geração, incremento subsequente sob lock | Spec manda incrementar (`spec:360`); confirmação do valor inicial na ambiguidade 3 |
| Exclusão de currículo com versões | `DELETE /v1/resumes/:id` responde **409** se houver versões; `resume_versions` não é apagada | Implicação direta de append-only (decisão 3); `204` somente sem versões |
| Default por usuário | No máximo um `is_default = true`, trocado na mesma transação; não há exigência de default sempre presente | Decisão 4; MySQL não oferece índice parcial simples para a regra, que fica na camada transacional |
| Anos reais de experiência | Soma das durações das experiências, considerando `is_current`/`current` até hoje (`spec:261`); o campo `years` de skill não entra nessa soma até confirmação | Segue a regra explícita da spec; ambiguidade 7 registra a dúvida sobre `skill.years` |
| Arredondamento | `Math.round` do score já limitado a `[0, 100]` | Decisão 7; ambiguidade 8 pede confirmação |

### Dependências

- Sprint 1: `users`, JWT com `sub`, `JwtAuthGuard`, `@CurrentUser()`, `ValidationPipe`
  com `whitelist`/`forbidNonWhitelisted`, filtro único de erro
  `{ statusCode, error, message, path, timestamp }` e helpers existentes.
- Sprint 2: perfil estruturado, `experiences` e seus bullets/highlights, `educations`,
  `certifications`, `languages` e `skills` — entradas do builder de snapshot.
- Sprint 3: `jobs`, `job_skills` e catálogo `skills` com `name`/`aliases` — entrada da
  extração de keywords. `npm run seed:skills` deve ter sido executado.
- Sprint 4: `applications` com `resume_version_id` nullable; permanece intocada.
- Migration `1795737600000-CreateResumeDomain` sequencial após
  `1795046400000-CreateApplicationsDomain`; `synchronize: false` mantido.
- MySQL local para e2e (`docker compose up -d` em `kandid_api/`).

### Fora de escopo

- Export JSON/HTML e suas rotas (KAN-50/51, Sprint 6).
- Vínculo candidatura↔`resume_version` e qualquer alteração em `applications`,
  entrevistas ou dashboards.
- IA, LLM, PDF/DOCX, upload de arquivos, OCR, rankings entre candidatos e
  recomendações automáticas.
- Edição de versão já gerada, `PATCH`/`DELETE /v1/resume-versions/:id` ou qualquer
  escrita em `content_snapshot`.
- `PATCH`/`DELETE` em `ats_analysis`; histórico é append-only.
- Roles, permissões, multi-tenant e deploy/banco remoto.

## Validação local (2026-11-19)

Branch `feat/sprint-5-resumes`, base `46f4e8a`. Nenhuma implementação, teste, migration,
demo, commit, push, PR ou deploy executado nesta etapa de planejamento.

| Verificação | Resultado |
|---|---|
| `npm run lint` | Pendente — aguardando implementação |
| `npx tsc --noEmit -p tsconfig.json` | Pendente — aguardando implementação |
| `npm run build` | Pendente — aguardando implementação |
| `git diff --check` | Pendente — aguardando implementação |
| `npm test` (unitários do motor ATS: normalizer, job-parser, resume-extractor, scorer, checks) | Pendente — aguardando implementação |
| `npm run test:e2e` (MySQL local; fluxo completo criar→versionar→analisar→consultar) | Pendente — aguardando implementação |
| `npm run migration:run` → `npm run migration:revert` → `npm run migration:run` → `npm run migration:show` | Pendente — aguardando implementação |
| Drift de schema via `npm run typeorm -- schema:log -d src/database/data-source.ts` | Pendente — aguardando implementação |
| Revisão read-only e Swagger em `/docs` | Pendente — aguardando implementação |
| Demo manual (seção abaixo) | Pendente — aguardando implementação |
| Git (commit/push/PR/merge/deploy) | Pendente — aguardando implementação |

Observação: ao contrário da Sprint 4, **testes são esperados nesta sprint**, em
especial os unitários do motor ATS com vaga realista e currículo (Fase 3 da spec).

## Critérios de aceite

### KAN-40 — Criar currículo e gerar versão

**Como** usuário autenticado **quero** criar currículos e gerar versões imutáveis
a partir do meu perfil **para** ter snapshots estáveis como entrada do ATS e de
exportações futuras.

- Dado que estou autenticado, quando envio `POST /v1/resumes` com `{ "name": "Backend", "targetRole": "Desenvolvedor Backend Sênior", "isDefault": true }`, então recebo 201 com `ResumeResponseDto` contendo `userId` igual ao `sub` do token, `isDefault: true` e `createdAt`/`updatedAt` em ISO 8601 UTC.
- Dado que envio `name` vazio, ausente ou acima de 120 caracteres, `targetRole` acima de 160 caracteres ou `isDefault` não-booleano, quando crio, então recebo 400 com mensagem indicando o campo inválido e nada é persistido.
- Dado que envio `userId`, `user_id`, `is_default`, `createdAt`, `updatedAt` ou qualquer campo fora do DTO, quando crio ou atualizo, então recebo 400 pelo `forbidNonWhitelisted`.
- Dado que omito `targetRole` ou `isDefault` no POST, quando crio, então são persistidos como `null` e `false`, respectivamente; dado que os informo válidos, então substituem o default.
- Dado que já existe um currículo meu com `isDefault: true`, quando crio ou atualizo outro com `isDefault: true`, então o anterior passa a `false` na **mesma transação**; no máximo um currículo do usuário fica com default. Falha em qualquer escrita reverte ambas.
- Dado que listo `GET /v1/resumes`, então recebo somente currículos do meu `userId` em `{ data, meta: { page, limit, total, totalPages } }`, com `page` default 1, `limit` default 20 (máximo 100) e ordem fixa `createdAt DESC, id ASC`; `page < 1`, `limit < 1`, `limit > 100` ou parâmetro fora da whitelist → 400.
- Dado que consulto `GET /v1/resumes/:id`, então recebo 200 com o mesmo `ResumeResponseDto`; currículo de outro usuário, inexistente ou `:id` inválido → 404 ou 400 (`ParseUUIDPipe`), respectivamente, sem revelar existência.
- Dado que envio `PATCH /v1/resumes/:id` com um subconjunto de `name`, `targetRole` e `isDefault`, quando atualizo, então recebo 200 e os campos ausentes permanecem inalterados; `null` em `name` → 400 e `null` em `targetRole` limpa o campo.
- Dado que envio `DELETE /v1/resumes/:id` sem versões vinculadas, então recebo 204; dado que existem versões, então recebo 409 e nada é apagado, preservando append-only.
- Dado que possuo perfil completo e envio `POST /v1/resumes/:id/versions` sem body, então recebo 201 com `id`, `resumeId`, `version`, `contentSnapshot`, `atsScore: null` e `createdAt`; o snapshot contém `schemaVersion: "1.0"`, `generatedAt` ISO 8601 UTC, `targetRole` do currículo e `candidate`, `summary`, `skills`, `experiences`, `education`, `certifications`, `languages` e `projects` do perfil.
- Dado que não existe perfil cadastrado, quando gero uma versão, então recebo 400 com mensagem clara indicando que o perfil é necessário e nenhuma versão é criada.
- Dado que gero versões em sequência, então `version` é 1, 2, 3... (ambiguidade 3) e `unique(resume_id, version)` é respeitada; duas requisições concorrentes na mesma transação com `pessimistic_write` geram versões distintas, sem duplicidade.
- Dado que tento violar `unique(resume_id, version)` em corrida, então recebo 409 e nenhuma versão duplicada é persistida (traduzindo `ER_DUP_ENTRY`).
- Dado que a versão foi criada, quando tento `PATCH`, `DELETE` ou reenviar o POST para alterar `contentSnapshot`, `version`, `resumeId` ou `createdAt`, então não existe rota contratada: nada é modificado; o snapshot permanece idêntico ao original.
- Dado que consulto `GET /v1/resume-versions/:id`, então recebo 200 com o snapshot imutável e `atsScore` igual ao score da análise mais recente, ou `null` se ainda não houver análise; versão de outro usuário/inexistente → 404, `:id` inválido → 400.
- Dado que não envio `Authorization`, quando chamo qualquer rota de KAN-40, então recebo 401.

### KAN-41 — Extrair keywords da vaga

**Como** usuário autenticado **quero** extrair requisitos e diferenciais da descrição
da vaga **para** comparar a vaga com o currículo de forma determinística.

- Dado que a descrição contém `Requisitos: Node.js, TypeScript` e `Diferenciais: Kubernetes`, quando executo o parser com o catálogo de skills, então `required` contém Node.js e TypeScript, `niceToHave` contém Kubernetes e cada item traz o `skill_id` correspondente.
- Dado que a descrição não contém nenhum título de seção reconhecido, quando executo o parser, então todos os matches são classificados como `required` e `niceToHave` fica vazio.
- Dado que a descrição usa `Obrigatório`, `Necessário`, `Requirements` ou `Must have`, quando executo o parser, então a seção é reconhecida como obrigatória; `Desejável`, `Plus`, `Preferencial`, `Nice to have` ou `Diferenciais` → desejável, conforme `docs/prompt-kandid.md:222-225`.
- Dado que a descrição traz `5+ anos de experiência` ou `3 years`, quando executo o parser, então `yearsRequired` é 5 ou 3, respectivamente, pela regex `(\d+)\s*\+?\s*(anos|years)`; sem menção → `yearsRequired` ausente.
- Dado que a descrição menciona `C++`, `C#`, `.NET`, `Node.js` ou `CI/CD`, quando a normalização roda com entrada `Node.JS  c++  CI/CD`, então o texto vira `nodejs cpp cicd`, com lowercase, sem acentos, espaços colapsados e símbolos canonicalizados antes do matching (`c++→cpp`, `c#→csharp`, `.net→dotnet`, `node.js→nodejs`, `ci/cd→cicd`).
- Dado que uma skill possui aliases de tamanhos diferentes, quando faço o matching, então os aliases são testados em ordem decrescente de tamanho, evitando match parcial, e o resultado é deduplicado por `skill_id`.
- Dado que a descrição contém números relevantes de anos, quando normalizo, então os números são preservados para a extração de anos.
- Dado que a descrição traz um termo de senioridade reconhecido, quando executo o parser, então `seniorityHint` recebe o membro correspondente de `Seniority`; caso contrário, o campo fica ausente/undefined.
- Dado o mesmo texto de vaga e o mesmo catálogo de skills, quando executo normalização e parser duas vezes, então obtenho exatamente o mesmo resultado, sem I/O, randomness ou IA nas funções do motor.

### KAN-42 — Calcular score e checks

**Como** usuário autenticado **quero** um score explicável e checks estruturais do
currículo **para** entender onde o perfil atende ou não à vaga.

- Dado um `content_snapshot`, quando extraio o texto ponderado, então `summary` tem peso 2, highlights das 2 experiências mais recentes têm peso 3, demais highlights peso 1, `skills` peso 2 e `projects` peso 1.
- Dado que uma keyword aparece em qualquer seção com peso ≥ 1, quando calculo a cobertura, então ela é considerada presente; o peso da seção entra no cálculo de cobertura.
- Dado que a vaga exige hard skills obrigatórias e desejáveis, quando calculo o score, então as dimensões usam exatamente os pesos 35 e 10 e a fórmula `peso * (peso dos matches / peso total exigido)`, com `matched` e `missing` preenchidos por dimensão.
- Dado que a vaga não pede anos, não menciona formação/certificação ou idiomas, quando calculo, então essas dimensões são marcadas como `notApplicable` (`applicable: false`) e os pesos das dimensões aplicáveis são renormalizados proporcionalmente.
- Dado que a senioridade do currículo é igual à exigida, quando calculo, então a dimensão vale 100%; diferença de 1 nível vale 60%; diferença ≥ 2 vale 0%.
- Dado que a vaga exige `N` anos e o currículo soma `A` anos reais, quando calculo, então a dimensão vale `min(100, A / N * 100)`; anos reais são a soma das durações das experiências, considerando `current`/`is_current` até hoje.
- Dado que o score bruto é negativo, maior que 100 ou fracionário, quando finalizo, então o valor é limitado a `[0, 100]` e arredondado com `Math.round` para inteiro (ambiguidade 8).
- Dado o mesmo snapshot, a mesma vaga extraída e o mesmo catálogo, quando calculo duas vezes, então score, `breakdown`, `checks`, `matchedKeywords` e `missingKeywords` são idênticos e determinísticos.
- Dado um snapshot, quando executo os checks estruturais, então são avaliados exatamente: `has-summary`, `has-contact` (e-mail e telefone), `has-experience`, `has-highlights`, `dates-consistent` (toda experiência com `startDate`; `current=true` sem `endDate`), `no-empty-required-sections`, `bullet-length` (≤ 220 caracteres), `has-skills`, `target-role-defined` e `no-duplicate-skills`.
- Dado que um check falha, quando monto o resultado, então `passed: false` e `detail` descreve o problema (por exemplo, `2 bullets acima de 220 caracteres`); quando passa, `passed: true` e `detail: null`.
- Dado que a estrutura do currículo é avaliada, quando calculo a dimensão de 5 pontos, então ela é a proporção de checks aprovados.
- Dado que a análise é gerada, quando persisto, então o JSON de saída segue o formato da spec com `score`, `breakdown[]`, `checks[]`, `matchedKeywords` e `missingKeywords`.

### KAN-43 — Persistir e consultar análise

**Como** usuário autenticado **quero** persistir e consultar análises ATS das minhas
versões **para** auditar o resultado de cada vaga ao longo do tempo.

- Dado que estou autenticado e a versão é minha, quando envio `POST /v1/resume-versions/:id/analyze` com `{ "jobId": "<uuid>" }` de vaga minha, então recebo 201 com `AtsAnalysisResponseDto` (`id`, `resumeVersionId`, `jobId`, `score`, `breakdown`, `checks`, `matchedKeywords`, `missingKeywords`, `createdAt`) e a análise é gravada em transação.
- Dado que a vaga não existe ou pertence a outro usuário, quando analiso, então recebo 404 sem revelar existência; `jobId` ausente ou inválido → 400; `:id` da versão inválido → 400 (`ParseUUIDPipe`).
- Dado que repito a análise para o mesmo par `(resume_version_id, job_id)`, quando envio o POST novamente, então uma **nova linha** é inserida (permitindo auditoria), sem `UPDATE` e sem `DELETE` em registros anteriores.
- Dado que existem várias análises para a mesma versão e vaga, quando consulto `GET /v1/resume-versions/:id/analysis`, então recebo 200 com a mais recente, ordenada por `created_at DESC, id ASC`.
- Dado que a versão ainda não tem análise, quando consulto o GET, então recebo 404 com mensagem indicando que não há análise para a versão.
- Dado que a versão pertence a outro usuário ou não existe, quando chamo POST ou GET de análise, então recebo 404; sem `Authorization` → 401.
- Dado que envio campos fora do DTO no POST de análise, quando analiso, então recebo 400 pelo `forbidNonWhitelisted`.
- Dado que a análise foi persistida, quando consulto `GET /v1/resume-versions/:id`, então `atsScore` reflete o score da análise mais recente, enquanto `contentSnapshot`, `version`, `resumeId` e `createdAt` permanecem byte a byte idênticos.
- Dado que a transação de análise falha em qualquer escrita, quando responde, então nenhuma linha de `ats_analysis` é persistida e nenhuma alteração acontece na versão.

## Contratos

Todas as rotas exigem `Authorization: Bearer <jwt>` e usam o prefixo global `/v1`.
O `userId` vem exclusivamente do token (`@CurrentUser()`). IDs de path usam
`ParseUUIDPipe`. Erros seguem `{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/v1/resumes` | `CreateResumeDto` | 201 `ResumeResponseDto` | 400, 401 |
| GET | `/v1/resumes` | query `page`, `limit` | 200 envelope paginado | 400, 401 |
| GET | `/v1/resumes/:id` | — | 200 `ResumeResponseDto` | 400, 401, 404 |
| PATCH | `/v1/resumes/:id` | `UpdateResumeDto` | 200 `ResumeResponseDto` | 400, 401, 404 |
| DELETE | `/v1/resumes/:id` | — | 204 | 400, 401, 404, 409 |
| POST | `/v1/resumes/:id/versions` | sem body | 201 `ResumeVersionResponseDto` | 400, 401, 404, 409 |
| GET | `/v1/resume-versions/:id` | — | 200 `ResumeVersionResponseDto` | 400, 401, 404 |
| POST | `/v1/resume-versions/:id/analyze` | `AnalyzeResumeDto` `{ jobId }` | 201 `AtsAnalysisResponseDto` | 400, 401, 404 |
| GET | `/v1/resume-versions/:id/analysis` | — | 200 `AtsAnalysisResponseDto` | 400, 401, 404 |

Não existem rotas de export, nem `PATCH`/`DELETE` de versão ou de análise.

Exemplo de criação (`POST /v1/resumes`):

```json
{
  "name": "Currículo Backend",
  "targetRole": "Desenvolvedor Backend Sênior",
  "isDefault": true
}
```

Resposta 201:

```json
{
  "id": "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
  "name": "Currículo Backend",
  "targetRole": "Desenvolvedor Backend Sênior",
  "isDefault": true,
  "createdAt": "2026-11-19T12:00:00.000Z",
  "updatedAt": "2026-11-19T12:00:00.000Z"
}
```

Exemplo de versão gerada (`POST /v1/resumes/3f2a.../versions`) — `contentSnapshot`
segue literalmente o contrato da spec (`docs/prompt-kandid.md:310-357`):

```json
{
  "id": "8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d",
  "resumeId": "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  "version": 1,
  "jobId": null,
  "atsScore": null,
  "createdAt": "2026-11-19T12:05:00.000Z",
  "contentSnapshot": {
    "schemaVersion": "1.0",
    "targetRole": "Desenvolvedor Backend Sênior",
    "generatedAt": "2026-11-19T12:05:00.000Z",
    "candidate": {
      "name": "Nome Sobrenome",
      "headline": "Backend Developer",
      "email": "email@exemplo.com",
      "phone": "+55 11 99999-9999",
      "location": "São Paulo, SP, Brasil",
      "links": {
        "linkedin": "https://linkedin.com/in/usuario",
        "github": "https://github.com/usuario",
        "portfolio": "https://usuario.dev"
      }
    },
    "summary": "Resumo profissional...",
    "skills": [
      { "name": "Node.js", "category": "FRAMEWORK", "level": "ADVANCED", "years": 5 }
    ],
    "experiences": [
      {
        "company": "Acme",
        "role": "Backend Developer",
        "employmentType": "CLT",
        "workModel": "REMOTE",
        "location": "Remoto",
        "startDate": "2021-03",
        "endDate": null,
        "current": true,
        "highlights": ["Reduzi a latência da API em 40%..."]
      }
    ],
    "education": [
      {
        "institution": "Universidade X",
        "degree": "Bacharelado",
        "fieldOfStudy": "Ciência da Computação",
        "startDate": "2015-02",
        "endDate": "2019-12",
        "current": false
      }
    ],
    "certifications": [],
    "languages": [{ "name": "Inglês", "proficiency": "ADVANCED" }],
    "projects": []
  }
}
```

Exemplo de análise (`POST /v1/resume-versions/8b7c.../analyze` com
`{ "jobId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d" }`) — saída no formato da spec
(`docs/prompt-kandid.md:268-288`):

```json
{
  "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  "resumeVersionId": "8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d",
  "jobId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  "score": 78,
  "breakdown": [
    {
      "dimension": "requiredSkills",
      "weight": 35,
      "earned": 28,
      "applicable": true,
      "matched": ["Node.js", "TypeScript"],
      "missing": ["Kubernetes"],
      "detail": "2 de 3 skills obrigatórias encontradas"
    }
  ],
  "checks": [
    { "id": "has-summary", "passed": true, "detail": null },
    { "id": "bullet-length", "passed": false, "detail": "2 bullets acima de 220 caracteres" }
  ],
  "matchedKeywords": ["Node.js", "TypeScript"],
  "missingKeywords": ["Kubernetes"],
  "createdAt": "2026-11-19T12:10:00.000Z"
}
```

Exemplo de listagem (`GET /v1/resumes?page=1&limit=20`):

```json
{
  "data": [
    {
      "id": "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
      "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
      "name": "Currículo Backend",
      "targetRole": "Desenvolvedor Backend Sênior",
      "isDefault": true,
      "createdAt": "2026-11-19T12:00:00.000Z",
      "updatedAt": "2026-11-19T12:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Exemplo de erro (`PATCH /v1/resumes/3f2a...` com `{ "userId": "outro" }`):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "property userId should not exist",
  "path": "/v1/resumes/3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  "timestamp": "2026-11-19T12:15:00.000Z"
}
```

## Regras de negócio

1. **Ownership**: `userId` vem do JWT; toda consulta e escrita é filtrada por ele.
   `userId`/`user_id` no body → 400. Recurso alheio ou inexistente → 404, nunca 403.
   Vaga usada na análise deve pertencer ao mesmo usuário; outra vaga → 404.
2. **Currículo e default**: vários currículos por usuário; `name` obrigatório
   (1–120), `targetRole` opcional (≤ 160), `isDefault` default `false`. No máximo um
   default por usuário, ajustado na mesma transação (decisão 4). Não há regra de
   "sempre existe um default".
3. **Geração de versão**: transação obrigatória (`spec:436`) com `pessimistic_write`
   na linha do `resume`; `version` começa em 1 e incrementa; `unique(resume_id,
   version)` é a última linha de defesa contra duplicidade (409). O builder usa somente
   o perfil do mesmo usuário.
4. **Imutabilidade**: `content_snapshot`, `version`, `resumeId` e `createdAt` nunca
   são alterados; `resume_version` é append-only (decisão 3). Não há `UPDATE`, `DELETE`
   nem rotas de edição. `ats_score` permanece `null` na coluna; o score da resposta é
   derivado da análise mais recente (ver Resolução de conflitos).
5. **Snapshot**: `schemaVersion: "1.0"`, `generatedAt` em ISO 8601 UTC e seções
   `candidate`, `summary`, `skills`, `experiences`, `education`, `certifications`,
   `languages`, `projects`, conforme `spec:310-357`. Gerado uma vez, nunca reescrito.
6. **Motor ATS**: funções puras em `src/modules/ats/engine/`, sem IA, sem I/O e sem
   estado oculto. Entradas: `job.description` + catálogo de skills, e
   `content_snapshot`. Mesmas entradas → mesma saída.
7. **Normalização e parsing**: lowercase, sem acentos, espaços colapsados, símbolos
   canonicalizados antes do matching; anos preservados. Seções reconhecidas por
   títulos; sem seção → tudo `required`. Aliases em ordem decrescente de tamanho e
   dedup por `skill_id`.
8. **Score e renormalização**: pesos exatos 35/10/20/15/10/5/5; dimensão não
   aplicável é marcada e removida do denominador, com renormalização proporcional;
   `clamp` 0–100 e `Math.round` no fim. Resultado sempre traz `breakdown`, `checks`,
   `matched` e `missing`.
9. **Checks estruturais**: os dez checks de `spec:291-304`, avaliados no snapshot,
   nunca em HTML. `bullet-length` usa limite de 220 caracteres.
10. **Análise**: `POST /analyze` grava uma nova linha em `ats_analysis` sob transação;
    múltiplas linhas por par são permitidas. `GET /analysis` devolve a mais recente
    por `created_at DESC, id ASC`. Sem análise → 404. Nenhuma escrita em versão.
11. **Respostas e erros**: criação 201, leitura/atualização 200, delete 204,
    conflito 409, ausência de recurso 404, validação 400, sem token 401. Nenhum DTO
    expõe credenciais. Swagger documenta todos os endpoints e DTOs.
12. **Integração**: Sprint 3 (`jobs`, `job_skills`, `skills`) e Sprint 2 (perfil) são
    somente leitura. `applications` permanece intocada e `resumeVersionId` continua
    `null`. Nenhuma rota de export é adicionada.

## Modelo de dados

Migration versionada sugerida `1795737600000-CreateResumeDomain`, classe
`CreateResumeDomain1795737600000`, sequencial após
`1795046400000-CreateApplicationsDomain`. `synchronize: false` mantido. PKs
`varchar(36)` com UUID; `created_at`/`updated_at` em `datetime(6)`;
`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`. FKs com nomes
explícitos idênticos em entidade e migration. Ajustar o timestamp se houver conflito,
registrando a escolha. Timestamp confirmado como sequencial: as últimas migrations são
`1795046400000`, `1794960000000`, `1794268800000` e `1794182400000`, sem conflito com
`1795737600000`.

Entidades TypeScript no singular — `Resume`, `ResumeVersion` e `AtsAnalysis` —
decoradas com os nomes de tabela plurais (`resumes`, `resume_versions`,
`ats_analyses`).

| Tabela | Campos principais | Restrições e FKs |
|---|---|---|
| `resumes` | `id`, `user_id`, `name varchar(120)`, `target_role varchar(160) NULL`, `is_default boolean NOT NULL default 0`, `created_at datetime(6)`, `updated_at datetime(6)` | FK `FK_resumes_user` (`user_id → users.id`, `CASCADE`); índice `(user_id, created_at)`. Unicidade do default garantida em transação, não por `UNIQUE` declarativo |
| `resume_versions` | `id`, `resume_id`, `version int`, `job_id varchar(36) NULL`, `content_snapshot json`, `ats_score int NULL`, `created_at datetime(6)` | `UNIQUE (resume_id, version)`; FK `FK_resume_versions_resume` (`resume_id → resumes.id`, `RESTRICT` — impede apagar currículo com versões); FK `FK_resume_versions_job` (`job_id → jobs.id`, `SET NULL` — a coluna é nullable e nenhuma rota desta sprint a preenche); append-only, sem `updated_at` |
| `ats_analyses` | `id`, `resume_version_id`, `job_id`, `score int`, `breakdown json`, `checks json`, `matched_keywords json`, `missing_keywords json`, `created_at datetime(6)` | FK `FK_ats_analyses_resume_version` (`resume_version_id → resume_versions.id`, `CASCADE`); FK `FK_ats_analyses_job` (`job_id → jobs.id`, `RESTRICT`, mantém a auditoria da vaga); índice `(resume_version_id, job_id, created_at, id)` para a consulta da mais recente; múltiplas linhas por par, append-only, sem `updated_at` |

Enums reaproveitados da spec (`docs/prompt-kandid.md:162-170`), sem criar novos:
`Seniority`, `WorkModel`, `ContractType`, `SkillCategory`, `SkillLevel`,
`LanguageProficiency`, `JobSource`. Os enums de perfil/vaga já existentes devem ser
importados, não duplicados. `ats_analyses` não ganha coluna `updated_at`: a ordem é
`created_at DESC, id ASC`.

## Demo manual

**Não executada pelo time — pendente para o humano.** Pré-condição: MySQL local no
Docker, `npm run migration:run`, `npm run seed:skills`, `npm run start:dev`, Swagger em
`/docs` e dois usuários registrados (`POST /v1/auth/register`) com `TOKEN_A` e
`TOKEN_B`. Use a branch `feat/sprint-5-resumes`; não criar commit nesta etapa.

1. Como A, complete o perfil (`PATCH /v1/me/profile`), incluindo skills com aliases
   relevantes, uma experiência recente com highlights, formação e idioma. Guarde os
   dados para conferir o snapshot.
2. Como A, `POST /v1/resumes` com `{"name":"Backend","targetRole":"Desenvolvedor Backend Sênior","isDefault":true}` → 201. Crie um segundo currículo com `isDefault: true` → 201; confirme que o primeiro voltou a `isDefault: false` em `GET /v1/resumes`.
3. Teste validações: `name` com 121 caracteres → 400; `userId` no body → 400; sem `Authorization` → 401; `GET /v1/resumes/:id` com `TOKEN_B` → 404; `:id` inválido → 400.
4. Como A, crie uma vaga com `POST /v1/jobs` cuja descrição contenha seções e skills reconhecidas, por exemplo: `Requisitos: Node.js, TypeScript, 5+ anos de experiência. Diferenciais: Kubernetes. Senioridade: Sênior.` Guarde o `jobId`.
5. Como A, `POST /v1/resumes/<id>/versions` → 201 com `version: 1` e snapshot completo. Repita → `version: 2`. Guarde o `id` da versão 1 e o JSON exato do `contentSnapshot`.
6. Confira a imutabilidade: `GET /v1/resume-versions/<id>` devolve o mesmo snapshot da versão 1; não há `PATCH`/`DELETE` de versão (404/405 conforme o framework). `DELETE /v1/resumes/<id>` com versões vinculadas → 409.
7. Como A, `POST /v1/resume-versions/<versao1>/analyze` com `{"jobId":"<jobId>"}` → 201 com `score`, `breakdown`, `checks`, `matchedKeywords` e `missingKeywords`. Confira que os pesos aplicáveis somam 100 após renormalização e que dimensões não aplicáveis estão marcadas.
8. Repita o POST de análise → 201 com nova linha. `GET /v1/resume-versions/<versao1>/analysis` → 200 com a análise mais recente por `created_at DESC, id ASC`.
9. `GET /v1/resume-versions/<versao1>` → `atsScore` igual ao score da análise mais recente, com o mesmo `contentSnapshot`/`version`/`createdAt` do passo 5.
10. Antes de analisar uma versão sem análise, confirme `GET .../analysis` → 404. Com `TOKEN_B`, repita POST e GET de análise na versão de A → 404; com `jobId` alheio → 404; com `jobId` inválido → 400.
11. Verifique o isolamento final: com `TOKEN_B`, `GET /v1/resume-versions/<versao1>` e `GET .../analysis` → 404. Confirme que `resumeVersionId` de qualquer candidatura existente continua `null` e que não existem rotas de export nesta sprint.

## Riscos

| Risco | Mitigação |
|---|---|
| Duas gerações de versão em corrida duplicando `version` | Transação com `pessimistic_write` + `unique(resume_id, version)`; critério explícito e teste de concorrência na demo/unitários |
| Snapshot alterado acidentalmente por escrita de score | Decisão 3 prevalece: nenhum `UPDATE` em `resume_version`; score lido de `ats_analysis`; imutabilidade verificada nos passos 5 e 9 da demo |
| Spec pede atualização de `ats_score` (`spec:522`) | Conflito resolvido na seção própria; sinalizar no portão humano antes de considerar escrita na versão |
| Dois currículos com `is_default = true` para o mesmo usuário | Troca na mesma transação (decisão 4); critério e demo passo 2 |
| `ats_analysis` sem ordem estável ao consultar | Ordenação explícita `created_at DESC, id ASC`, com índice correspondente |
| Motor ATS divergente da spec (pesos, aliases, anos, renormalização) | Pesos copiados literalmente de `spec:251-264`; unit tests obrigatórios com vaga realista e currículo; ambiguidades 7 e 8 no portão |
| Matches parciais entre aliases (ex.: `node` dentro de `nodejs`) | Aliases ordenados por tamanho decrescente e dedup por `skill_id`; cenário nos unit tests |
| Vazamento entre usuários | Toda query parte do `userId` do JWT; alheio/inexistente → 404; demo passos 3, 10 e 11 |
| `DELETE /v1/resumes/:id` apagando versões e quebrando auditoria | FK `RESTRICT` + 409 quando há versões; 204 somente sem versões |
| Exclusão de vaga com análise persistida | `ats_analysis.job_id` com `RESTRICT`; comportamento consistente com a Sprint 4, sem alterar `applications` |
| Escopo de export invadido a Sprint 5 | Decisão 1 e fora de escopo explícito; nenhuma rota `/export` no contrato |
| `GET` de análise inventado sem confirmação | Decisão 5 registra a necessidade em KAN-43; ambiguidade 6 no portão |
| Testes ainda não escritos/executados | DoD exige unitários do motor e e2e com MySQL; validação local toda pendente |

## Definition of Done

- [ ] `docs/sprints/sprint-05.md` escrito com Escopo, Decisões, Resolução de conflitos, critérios Given/When/Then, contratos e exemplos, regras, modelo de dados, demo manual, riscos, DoD, tarefas, ambiguidades e referências.
- [ ] KAN-40, KAN-41, KAN-42 e KAN-43 implementados conforme os critérios acima, na branch `feat/sprint-5-resumes` (base `46f4e8a`).
- [ ] Entidades `resume`, `resume_version` e `ats_analysis`, DTOs, services, controllers, módulos e Swagger documentado, sem rotas fora da decisão 8.
- [ ] Migration `1795737600000-CreateResumeDomain` criada; cadeia local `migration:run` → `migration:revert` → `migration:run` → `migration:show` concluída e `schema:log` via CLI sem drift.
- [ ] **Testes unitários do motor ATS escritos e passando** (`normalizer`, `job-parser`, `resume-extractor`, `scorer`, `checks`), com vaga realista + currículo e fixtures determinísticas.
- [ ] `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npm test` e `npm run test:e2e` (com MySQL) executados com sucesso.
- [ ] `git diff --check` limpo e revisão read-only executada, com achados registrados.
- [ ] Demo manual executada pelo humano, incluindo imutabilidade da versão e isolamento entre usuários.
- [ ] Swagger em `/docs` com todos os endpoints, DTOs, envelopes e exemplos desta sprint.
- [ ] Nenhum segredo introduzido; `.env` não lido; nenhuma alteração em `applications` e nenhuma rota de export.
- [ ] Envios de commit/push/PR/merge/deploy aguardam aprovação humana, conforme `AGENTS.md`.

## Tarefas

- [x] Escrever `docs/sprints/sprint-05.md` (planejamento, critérios, contratos, regras, modelo, demo, riscos e ambiguidades).
- [ ] Architect: validar a migration e as oito ambiguidades; registrar decisões finais em ADR quando houver mudança.
- [ ] Migration `1795737600000-CreateResumeDomain` com as três tabelas, FKs explícitos, `unique(resume_id, version)` e índices.
- [ ] Entidades `Resume`, `ResumeVersion` e `AtsAnalysis` e enums reaproveitados.
- [ ] DTOs de request/response de currículo, versão e análise; nenhum DTO aceita `userId`/`user_id`.
- [ ] `ResumesService`: CRUD de currículo, default único em transação, 409 em exclusão com versões.
- [ ] Builder de snapshot a partir do perfil e geração de versão transacional com `pessimistic_write`.
- [ ] `src/modules/ats/engine/normalizer.ts` e `job-parser.ts` (KAN-41).
- [ ] `src/modules/ats/engine/resume-extractor.ts`, `scorer.ts` e `checks.ts` (KAN-42).
- [ ] `AtsAnalysisService` e rotas de análise, com consulta da mais recente (KAN-43).
- [ ] Controllers com `JwtAuthGuard`, `@CurrentUser()`, `ParseUUIDPipe`, Swagger e envelope paginado em `GET /v1/resumes`.
- [ ] Testes unitários do motor com fixtures; e2e do fluxo criar→versionar→analisar→consultar.
- [ ] `npm run lint`, `tsc`, `npm run build`, `npm test`, `npm run test:e2e`, cadeia de migration e `git diff --check`.
- [ ] Humano: validar as oito ambiguidades, executar a demo manual e decidir commit/PR/merge/deploy.

## Pendente de validação humana/architect

As oito ambiguidades abaixo foram **decididas para implementação** pelo tech lead/PO e
não devem bloquear o desenvolvimento. Nenhuma é irreversível: o humano/architect
confirma ou ajusta no portão final, com ADR quando houver mudança.

1. **Export JSON/HTML na Sprint 5 ou 6**
   - Decisão adotada: fica na Sprint 6 (KAN-50/51), conforme `docs/backlog.md`, apesar de a spec incluir export na Fase 3 (`spec:363-372,521,524`). Nenhuma rota `/export` nesta sprint.
   - Pendente: confirmar se o portão mantém o sequenciamento do backlog ou antecipa KAN-50/51 para fechar a Fase 3 de uma vez.

2. **`applications` e `resume_version_id`**
   - Decisão adotada: Sprint 5 não altera `applications`; `resumeVersionId` continua `null` na resposta, e o vínculo candidatura↔versão vira história separada.
   - Pendente: confirmar a história do vínculo (INPUT manual ou sugestão da análise) e se `resumeVersionId` continua exposto como `null` até lá.

3. **Numeração de `resume_version` e append-only**
   - Decisão adotada: primeira versão com `version = 1`, incremento sob transação com `pessimistic_write`, `unique(resume_id, version)`, sem `UPDATE` e sem `DELETE`.
   - Pendente: confirmar que `version` começa em 1 (e não em 0) e que a coluna `ats_score` permanece sem escrita física, com o score servido a partir de `ats_analysis`.

4. **Múltiplos currículos e `is_default`**
   - Decisão adotada: vários `resume` por usuário; no máximo um `is_default = true`, garantido em transação; não é obrigatório existir um default.
   - Pendente: confirmar se o produto exige sempre um default (por exemplo, criando o primeiro como default automaticamente) ou se o modelo atual é suficiente.

5. **Múltiplas linhas em `ats_analysis` e ordenação da consulta**
   - Decisão adotada: várias análises por `(resume_version_id, job_id)` para auditoria; `GET` devolve a mais recente por `created_at DESC, id ASC`; sem `updated_at`.
   - Pendente: confirmar se a retenção é ilimitada ou se haverá política de limpeza/limite em história futura.

6. **Rota de consulta da análise**
   - Decisão adotada: `GET /v1/resume-versions/:id/analysis`, necessária para KAN-43 porque a spec só define `POST /analyze`.
   - Pendente: confirmar o contrato do GET (status quando não há análise — 404 proposto — e se o resultado deve ser paginado/histórico em vez de apenas o mais recente).

7. **Anos de experiência x `skill.years`**
   - Decisão adotada: anos reais = soma das durações das experiências, com `current`/`is_current` até hoje, conforme `spec:261`; `years` de skill não entra nessa soma; motor sem IA e funções puras.
   - Pendente: confirmar se `years` de skill deve entrar no cálculo de anos reais ou apenas como sinal de cobertura de skills.

8. **Arredondamento do score**
   - Decisão adotada: pesos exatos da spec (35/10/20/15/10/5/5), renormalização, `clamp` 0–100 e `Math.round` para inteiro.
   - Pendente: confirmar `Math.round` (em vez de `floor`/`ceil`) e se o breakdown deve expor pesos já renormalizados ou os pesos originais da spec.

## Referências

- `docs/prompt-kandid.md:147-158` — modelo de `resume`, `resume_version` (imutável,
  `unique(resume_id, version)`) e `ats_analysis`.
- `docs/prompt-kandid.md:162-176` — enums, incluindo `Seniority`, `SkillCategory`,
  `SkillLevel` e `LanguageProficiency`.
- `docs/prompt-kandid.md:205-305` — motor ATS: normalização, job-parser,
  resume-extractor, scorer, formato de saída e checks estruturais.
- `docs/prompt-kandid.md:306-362` — contrato do snapshot e geração de versão.
- `docs/prompt-kandid.md:363-372` — export JSON/HTML (fora do escopo desta sprint).
- `docs/prompt-kandid.md:374-423` — API `/v1`, incluindo rotas de currículo, versão,
  análise e export.
- `docs/prompt-kandid.md:425-436` — convenções de API (auth, validação, ownership,
  paginação, erros, Swagger, transações).
- `docs/prompt-kandid.md:516-524` — Fase 3 (Currículo + ATS) e critério de pronto.
- `docs/backlog.md:102-109` — E4 e histórias KAN-40 a KAN-43.
- `docs/backlog.md:111-119` — E5, com KAN-50/51 (export) na Sprint 6.
- `docs/sprints/sprint-04.md` — padrão de documento e decisões da Sprint 4
  (especialmente `resume_version_id` reservado em `applications`).
- `AGENTS.md` — branches curtas, TDD quando aplicável, qualidade e proibição de
  commit/push/deploy sem aprovação humana.
