# Sprint 4 — Candidaturas (máquina de estados e histórico)

- Status: Implementada localmente — aguardando validação humana (testes, demo e commit)
- Branch: `feat/sprint-2-profile` (branch atual; Sprint 2 e Sprint 3 seguem juntas, uncommitted, até o humano decidir commit/separação). Nenhuma branch nova foi criada: decisão do tech lead para não separar o trabalho não commitado da Sprint 2 (HEAD `00b0647`).
- Início: 2026-11-18 (documento de planejamento)
- Encerramento local: 2026-11-18 — implementação de KAN-30 a KAN-33, validações estáticas (lint, `tsc`, build, `git diff --check`) e cadeia local de migration concluídas; o fechamento final depende de testes, demo manual e decisão de commit do humano
- Épico: E3 (`docs/backlog.md`)

## Objetivo

Permitir que o usuário autenticado crie candidaturas para vagas suas, percorra a
máquina de estados com histórico append-only auditável, registre valores propostos e
ofertados em centavos e encontre candidaturas por filtros e paginação, fechando a
Fase 2 da spec (`docs/prompt-kandid.md:508-514`).

## Escopo

### Histórias

| ID | História | Entrega principal | Estimativa |
|---|---|---|---|
| KAN-30 | Criar candidatura para vaga | `POST /v1/jobs/:id/applications`, `GET /v1/applications/:id`, `unique(user_id, job_id)` → 409, status inicial `SAVED` | 1 dia |
| KAN-31 | Transicionar status com histórico | `PATCH /v1/applications/:id/status`, `APPLICATION_TRANSITIONS`, `application_status_history` na mesma transação, `GET .../:id/history` | 2 dias |
| KAN-32 | Registrar valores proposto e ofertado | `PATCH /v1/applications/:id/compensation`, centavos em `bigint`, `currency`/`salary_period`, `benefits` | 1 dia |
| KAN-33 | Filtrar e paginar candidaturas | `GET /v1/applications` com `status`, `companyId`, `from`, `to`, `page`, `limit` e envelope `{ data, meta }` | 1 dia |

Definition of Ready por história: critérios Given/When/Then abaixo, contrato na seção
Contratos, demo manual executável (pendente para o humano), dependências listadas e
estimativa ≤ 2 dias.

### Decisões registradas (humano / tech lead / PO)

1. **Status inicial é `SAVED`**. É critério de aceito explícito do KAN-30, confirmado
   neste documento. O campo `status` NÃO é aceito no body do POST: tentativa → 400.
2. **Unicidade e ownership**: `unique(user_id, job_id)` gera **409** (inclusive em
   corrida via `ER_DUP_ENTRY`). A vaga deve pertencer ao mesmo usuário do JWT; vaga
   alheia ou inexistente em `POST /v1/jobs/:id/applications` → **404**. O `jobId` vem
   do path, nunca do body.
3. **Transição atômica**: atualizar `application.status` e inserir
   `application_status_history` acontece em **uma única transação**, com a linha da
   candidatura bloqueada para evitar duas transições concorrentes vencedoras.
   Transição inválida → **400** com mensagem listando os estados permitidos e sem
   nenhuma escrita.
4. **Criação não gera linha de histórico** (decisão provisória, sujeita ao portão
   final): o histórico registra **transições**, não a inserção da candidatura. A
   primeira linha aparece na primeira mudança de status, com `from_status = SAVED`.
   `from_status` permanece `nullable` no modelo, conforme a spec, reservado para
   necessidade futura (por exemplo, importação/estado desconhecido).
5. **Estados terminais** são exatamente `HIRED`, `REJECTED`, `WITHDRAWN` e `CANCELLED`.
   `GHOSTED` **não** é terminal (a spec permite sair dele), portanto NÃO preenche
   `closed_at`. `applied_at` é preenchido ao entrar em `APPLIED`, se estiver vazio.
6. **`applications.job_id` usa `ON DELETE RESTRICT`**: excluir vaga com candidatura
   vinculada passa a responder **409** no `DELETE /v1/jobs/:id` da Sprint 3. Isso
   preserva a auditoria; a checagem entra no `JobsService`, sem criar endpoint novo.
7. **Campos descritivos da candidatura** (`notes`, `nextStepAt`, `lastContactAt`,
   `rejectionReason`) são opcionais no POST do KAN-30 e atualizáveis no PATCH de
   compensação do KAN-32. Não foi criado `PATCH /v1/applications/:id`, que não existe
   na spec. `status` continua alterável somente pela rota de status.
8. **Filtro `companyId` alheio/inexistente** em `GET /v1/applications` devolve envelope
   vazio (`total: 0`), seguindo o precedente do ADR 0003 para filtros de coleção.
   Recurso por `:id` alheio/inexistente continua **404**.
9. **Desvio do DoD nesta execução**: por instrução explícita do usuário, TESTES
   (unitários e e2e), DEMO MANUAL e COMMIT não foram escritos, executados ou feitos
   pelo time e seguem com o humano. Lint, `tsc`, build, `git diff --check`, revisão
   read-only e a cadeia local de migration, porém, **foram executados** nesta execução;
   o desvio remanescente é apenas testes/demo/commit.
10. **Branch mantida**: `feat/sprint-2-profile`. Sprint 2, Sprint 3 e o planejamento
    da Sprint 4 ficam juntos e uncommitted até o humano decidir commit ou separação;
    nenhuma branch nova é criada.

### Resolução de conflitos entre este documento, a spec e o ADR 0003 (tech lead/PO)

O ADR 0003 (`docs/adr/0003-sprint-3-pipeline.md`) e a spec divergem em pontos que a
Sprint 4 precisa resolver. A implementação deve seguir **esta** seção:

| Tema | Decisão | Justificativa |
|---|---|---|
| Status inicial da candidatura | `SAVED`, sempre; `status` no POST → 400 | Spec sugere o inicial e a máquina começa nele; aceitar `status` no POST permitiria pular etapas |
| `unique(user_id, job_id)` | 409, inclusive em corrida | Constraint explícita da spec `:139`; upsert silencioso esconderia duplicate |
| Vaga alheia/inexistente no POST | 404 | Ownership da spec `:429`; não revelar existência |
| Escrita de histórico na criação | Nenhuma linha; primeira linha na primeira transição (provisório) | Spec fala em "ao transicionar"; `createdAt` já registra a criação. Reavaliar no portão final |
| `GHOSTED` como terminal | Não é terminal; sem `closed_at` | A máquina da spec `:189` permite sair de `GHOSTED` |
| `?companyId=` alheio/inexistente em listagem | Envelope vazio, sem 404 | Mesmo critério do ADR 0003 para `GET /v1/jobs`; 404 fica reservado a `:id` |
| `?sort=campo:asc\|desc` | Rejeitado com 400 | Como em sprint-03: o humano aprovou apenas `status`, `companyId`, `from`, `to`, `page` e `limit`; ordenação é fixa |
| `GET /v1/jobs/:id/application` | Fora de KAN-30; pendente de confirmação | Spec `:404` cita a rota, mas ela não está no escopo aprovado das histórias E3; ver Pendente 5 |
| `DELETE /v1/applications/:id` | Fora de escopo; nenhum 204 nesta sprint | Spec não lista a rota; retirada/cancelamento é transição com histórico. Ver Pendente 8 |
| `job_id` → `jobs.id` | `RESTRICT`; `DELETE /v1/jobs/:id` com candidatura → 409 | Evita candidatura órfã e perda de rastro da vaga; consistente com `jobs.company_id` no ADR 0003 |
| `resume_version_id` | Coluna nullable reservada; fora da API nesta sprint | `resume_version` só existe na Sprint 5; ver Pendente 1 |
| `benefits` | Array de strings, provisório | Forma simples e reversível; ver Pendente 2 |
| `from`/`to` | `created_at` (UTC), provisório | Toda candidatura tem `created_at`; `applied_at` é nulo até `APPLIED`. Ver Pendente 4 |

As demais convenções do ADR 0003 permanecem: `userId` do JWT, `whitelist`/
`forbidNonWhitelisted`, filtro de erro único, `money.ts` com `fieldName` opcional,
tabelas em plural e `synchronize: false`. Nenhuma alteração de `jobs.status` é feita:
o filtro `?status` de `GET /v1/jobs` continua rejeitado com 400; o `status` do domínio
agora aparece em `GET /v1/applications`.

### Dependências

- Sprint 1 e 2 disponíveis na branch atual: `users`, JWT com `sub`, `JwtAuthGuard`,
  `@CurrentUser()`, `ValidationPipe` com `whitelist`/`forbidNonWhitelisted`, filtro
  único de erro e helpers `money.ts`, `null-fields.ts`, `is-duplicate-entry.ts`.
- Sprint 3 disponível na mesma branch: `jobs`, `companies`, `recruiters`,
  `job_skills`, migration `1794960000000-CreatePipelineDomain` e catálogo `skills`.
- `skills` semeado por `npm run seed:skills` (somente leitura pela API).
- Migration de candidaturas `1795046400000-CreateApplicationsDomain` criada e aplicada
  localmente, sequencial após `1794960000000-CreatePipelineDomain`. A cadeia
  `migration:run` → `migration:revert` → `migration:run` → `migration:show` foi executada
  nesta execução; a decisão sobre commit/PR segue com o humano.
- `resume_version` não existe ainda (Sprint 5); por isso `resume_version_id` fica
  reservado no modelo e ausente da API (Pendente 1).

### Fora de escopo

- Entrevistas (`CRUD /v1/applications/:id/interviews`, KAN-52).
- Currículos, versões imutáveis, ATS, export JSON/HTML (KAN-40 a KAN-43, KAN-50 e KAN-51).
- Dashboards de funil e compensação (KAN-53 e KAN-54).
- Seed de demonstração (KAN-60), deploy e banco remoto (KAN-7 e KAN-8).
- `GET /v1/jobs/:id/application`: proposta de manter fora; pendente de confirmação
  (Pendente 5). Não confundir com entrega concluída.
- `DELETE /v1/applications/:id` e qualquer rota de alteração do histórico; nenhuma
  resposta 204 nesta sprint (Pendente 8).
- `sort` configurável, `status` em `GET /v1/jobs`, paginação em `companies`/
  `recruiters` e qualquer endpoint novo não listado em Contratos.
- Testes unitários/e2e, demo manual e commit nesta execução (desvio registrado no DoD).
- Roles, permissões, multi-tenant, IA, PDF/DOCX e upload de arquivos.

## Validação local (2026-11-18)

Execução na branch `feat/sprint-2-profile`, HEAD `00b0647`, com KAN-30 a KAN-33
implementados. Nenhuma branch nova, commit, push, PR, merge ou deploy.

| Verificação | Resultado |
|---|---|
| `npm run lint` | exit 0; único warning preexistente em `test/auth.e2e-spec.ts:232` |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |
| `npm run migration:run` → `npm run migration:revert` → `npm run migration:run` → `npm run migration:show` | cadeia concluída: 1ª aplicação, revert, nova aplicação e 4 migrations aplicadas ao final, incluindo `1795046400000-CreateApplicationsDomain` |
| Drift de schema | `npm run typeorm -- schema:log -d src/database/data-source.ts` → “Your schema is up to date - there are no queries to be executed by schema synchronization”, exit 0 |
| Testes unitários e e2e | nenhum teste escrito ou executado; fica com o humano |
| Demo manual | não executada; fica com o humano |
| Revisão de código | revisão read-only executada; achados corrigidos e decisão sobre `sort` registrados em Correções pós-revisão |
| Git | nenhum commit, push, PR, merge, release ou deploy; alterações seguem uncommitted em `00b0647` |

Nota: `npm run schema:log` **não existe** em `package.json`. O drift foi conferido pelo
CLI direto (`npm run typeorm -- schema:log -d src/database/data-source.ts`), não por um
script npm próprio.

A implementação e as validações estáticas/migration local estão concluídas; testes, demo
manual e a decisão de commit/push/PR/merge/deploy permanecem com o humano.

### Correções pós-revisão

- **ALTO — `currency`/`salaryPeriod: null` no POST**: `@IsOptional()` aceitava `null`;
  trocado por `@ValidateIf(value !== undefined)` em `CreateApplicationDto`, preservando
  `null → 400` e a herança quando omitidos.
- **BAIXO — injeção morta**: `jobsRepository` removido de `ApplicationsService` e de
  `ApplicationsModule`.
- **MÉDIO — `?sort=` em `GET /v1/applications` (decisão do tech lead)**: parâmetros
  desconhecidos retornam `400` pelo `forbidNonWhitelisted` global; `sort` tem validação
  explícita e devolve a mensagem rica
  `Unsupported query parameters: sort. Supported: status, companyId, from, to, page, limit`,
  conforme o exemplo do ADR. Outros parâmetros fora da whitelist podem usar a mensagem
  padrão do pipe. O `ValidationPipe` global **não** foi alterado: é exceção documentada,
  não pendência de código.

## Critérios de aceite

### KAN-30 — Criar candidatura para vaga

**Como** usuário autenticado **quero** criar uma candidatura para uma vaga minha
**para** acompanhar o processo desde o estado inicial `SAVED`.

- Dado que estou autenticado, quando envio `POST /v1/jobs/:id/applications` com uma vaga minha, então recebo 201 com `ApplicationResponseDto`, `userId` igual ao `sub` do token, `status: "SAVED"`, `appliedAt: null` e `closedAt: null`.
- Dado que já tenho candidatura para a mesma vaga, quando repito o POST, então recebo 409 por `unique(user_id, job_id)`, sem nova linha persistida; outro usuário pode criar candidatura para vaga dele com o mesmo `jobId`.
- Dado que a vaga pertence a outro usuário ou não existe, quando crio candidatura, então recebo 404 sem revelar existência.
- Dado que envio `jobId`, `userId`, `user_id`, `status`, `appliedAt`, `closedAt` ou `resumeVersionId` no body, quando crio, então recebo 400 e nada é persistido; `jobId` vem exclusivamente do path.
- Dado que omito `currency` e `salaryPeriod`, quando crio, então ambos herdam da vaga; dado que os informo com valores válidos, então substituem o default; `null` em qualquer um → 400 (proposta pendente 3).
- Dado que envio `benefits` como array de strings, quando crio, então o valor é persistido e retornado; `benefits` omitido ou `null` → `null`; item não-string → 400 (proposta pendente 2).
- Dado que envio `proposedSalaryCents` e `offeredSalaryCents` como inteiros ≥ 0 em centavos, quando crio, então recebo 201; negativo, não inteiro ou acima de `Number.MAX_SAFE_INTEGER` → 400.
- Dado que envio `notes`, `nextStepAt`, `lastContactAt` ou `rejectionReason`, quando crio, então os valores são persistidos; `nextStepAt`/`lastContactAt` em ISO 8601 UTC e `rejectionReason` com no máximo 500 caracteres, senão 400.
- Dado que crio a candidatura, quando consulto `GET /v1/applications/:id`, então recebo 200 com os mesmos dados; nenhuma linha de histórico é criada nesta operação (decisão 4).
- Dado que a vaga possui candidatura, quando tento `DELETE /v1/jobs/:id`, então recebo 409 e a vaga permanece (decisão 6).
- Dado que envio qualquer campo fora do DTO, quando crio, então recebo 400 pelo `forbidNonWhitelisted`.
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/applications` ou a rota de criação, então recebo 401.

### KAN-31 — Transicionar status com histórico

**Como** usuário autenticado **quero** mudar o status das minhas candidaturas com
histórico auditável **para** reconstruir cada etapa do processo sem perder informação.

- Dado que estou autenticado, quando envio `PATCH /v1/applications/:id/status` com `{ "status": "APPLIED" }`, então recebo 200 com o novo status e uma linha de histórico `from_status: "SAVED"`, `to_status: "APPLIED"`.
- Dado que envio `{ "note": "..." }` sem `status`, ou `status: null`/fora do enum, quando transiciono, então recebo 400 indicando o campo obrigatório/inválido.
- Dado que a transição respeita `APPLICATION_TRANSITIONS`, quando transiciono, então `application.status` é atualizado e `application_status_history` é inserido na **mesma transação**; uma falha em qualquer escrita reverte as duas.
- Dado que a transição é inválida — por exemplo `HIRED -> SCREENING`, `SAVED -> SAVED` ou `GHOSTED -> CANCELLED` —, quando transiciono, então recebo 400 com mensagem listando os estados permitidos a partir do status atual; nada é alterado e nenhuma linha de histórico é inserida.
- Dado que entro em `APPLIED` e `appliedAt` está vazio, quando transiciono, então `appliedAt` recebe a data atual; se já estiver preenchido, o valor original é preservado.
- Dado que entro em `HIRED`, `REJECTED`, `WITHDRAWN` ou `CANCELLED`, quando transiciono, então `closedAt` é preenchido; dado que entro em `GHOSTED`, então `closedAt` permanece `null` porque `GHOSTED` não é terminal.
- Dado que envio `note` com mais de 500 caracteres, quando transiciono, então recebo 400; `note` omitida ou `null` é aceita e persistida como `null` (proposta pendente 7).
- Dado que duas requisições concorrentes tentam transições diferentes da mesma candidatura, então no máximo uma vence; a outra recebe 400 com os estados permitidos a partir do status já persistido.
- Dado que consulto `GET /v1/applications/:id/history`, então recebo 200 com o array de linhas ordenado por `changedAt` ASC e `id` ASC, sem expor `userId`.
- Dado que tento alterar o histórico por `PATCH` ou `DELETE`, então não existe rota contratada: nenhuma linha é modificada; a imutabilidade é preservada.
- Dado que a candidatura pertence a outro usuário ou não existe, quando chamo `GET`, `PATCH` de status ou `GET` de histórico, então recebo 404; sem `Authorization` → 401.

### KAN-32 — Registrar valores proposto e ofertado

**Como** usuário autenticado **quero** registrar valores propostos e ofertados com
moeda e periodicidade explícitas **para** comparar propostas sem ambiguidade de unidade.

- Dado que estou autenticado, quando envio `PATCH /v1/applications/:id/compensation` com um subconjunto de campos válidos, então recebo 200 com a candidatura atualizada; campos ausentes permanecem inalterados.
- Dado que envio `proposedSalaryCents` e `offeredSalaryCents` como inteiros ≥ 0, quando atualizo, então os centavos são persistidos em `bigint`; negativo, não inteiro ou acima de `Number.MAX_SAFE_INTEGER` → 400.
- Dado que o driver MySQL devolve `bigint` como string, quando leio a candidatura, então a resposta expõe os centavos como número JSON; a persistência envia string.
- Dado que envio `currency` fora de três letras maiúsculas, ou `salaryPeriod` fora de `MONTH|YEAR|HOUR|DAY`, quando atualizo, então recebo 400; `null` em qualquer um dos dois → 400.
- Dado que envio `benefits`, quando atualizo, então o array de strings substitui o anterior; `null` limpa o campo e o retorna como `null` (proposta pendente 2).
- Dado que envio `notes`, `nextStepAt`, `lastContactAt` ou `rejectionReason`, quando atualizo, então esses campos opcionais mudam; `null` limpa cada um deles e o retorna como `null`.
- Dado que envio `proposedSalaryCents` maior que `offeredSalaryCents` (ou vice-versa), quando atualizo, então recebo 200: não existe regra `min <= max` entre proposto e ofertado nesta sprint; a comparação pertence ao dashboard (KAN-54).
- Dado que envio `status`, `userId`, `user_id` ou campo fora do DTO, quando atualizo, então recebo 400 e nada é persistido.
- Dado que a candidatura pertence a outro usuário ou não existe, quando atualizo, então recebo 404; sem `Authorization` → 401.

### KAN-33 — Filtrar e paginar candidaturas

**Como** usuário autenticado **quero** filtrar e paginar minhas candidaturas **para**
encontrar rapidamente o que está em cada etapa do funil.

- Dado que listo `GET /v1/applications` sem filtros, então recebo somente as minhas candidaturas dentro de `{ data, meta: { page, limit, total, totalPages } }`, com `page` default 1 e `limit` default 20 (máximo 100).
- Dado que informo `page < 1`, `limit < 1` ou `limit > 100`, quando listo, então recebo 400.
- Dado que informo `?status=SCHEDULED`, quando listo, então recebo apenas candidaturas nesse status; valor fora de `ApplicationStatus` → 400.
- Dado que informo `?companyId=` de empresa minha, quando listo, então recebo apenas candidaturas cujas vagas pertencem a essa empresa; empresa alheia ou inexistente → envelope vazio (`total: 0`), sem 404.
- Dado que informo `?from=2026-11-01&to=2026-11-18`, quando listo, então o filtro usa `createdAt` em UTC, com `from` no início do dia e `to` no fim do dia; formato diferente de `YYYY-MM-DD`, data inexistente ou `from > to` → 400 (proposta pendente 4).
- Dado que combino filtros, quando listo, então a relação é AND entre eles; a ordenação é fixa e estável: `createdAt DESC`, `id ASC`.
- Dado que `total` é 42 e `limit` é 20, quando listo, então `totalPages` é 3; com `total: 0`, `totalPages` é 0.
- Dado que informo uma página além do fim, quando listo, então recebo 200 com `data: []` e o `meta` correto — não 404.
- Dado que envio `?sort=status:asc` ou qualquer parâmetro fora da whitelist, quando listo, então recebo 400 listando os parâmetros suportados (proposta pendente 6).
- Dado que não envio o header `Authorization`, quando listo, então recebo 401.

## Contratos

Todas as rotas exigem `Authorization: Bearer <jwt>` e usam o prefixo global `/v1`.
O `userId` vem exclusivamente do token. Erros seguem
`{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/v1/jobs/:id/applications` | `CreateApplicationDto` | 201 `ApplicationResponseDto` | 400, 401, 404, 409 |
| GET | `/v1/applications` | query `status`, `companyId`, `from`, `to`, `page`, `limit` | 200 envelope paginado | 400, 401 |
| GET | `/v1/applications/:id` | — | 200 `ApplicationResponseDto` | 401, 404 |
| PATCH | `/v1/applications/:id/status` | `UpdateApplicationStatusDto` `{ status, note? }` | 200 `ApplicationResponseDto` | 400, 401, 404 |
| PATCH | `/v1/applications/:id/compensation` | `UpdateApplicationCompensationDto` | 200 `ApplicationResponseDto` | 400, 401, 404 |
| GET | `/v1/applications/:id/history` | — | 200 `ApplicationStatusHistoryResponseDto[]` | 401, 404 |

Não há rota de `DELETE` nesta sprint e, portanto, nenhuma resposta **204**; a decisão
está registrada na seção Pendente 8. `GET /v1/jobs/:id/application` não é entregue em
KAN-30 (Pendente 5).

Exemplo de criação (`POST /v1/jobs/1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d/applications`):

```json
{
  "proposedSalaryCents": 950000,
  "offeredSalaryCents": null,
  "benefits": ["Plano de saúde", "Vale refeição"],
  "nextStepAt": "2026-11-25T14:00:00.000Z",
  "notes": "Candidatura enviada após indicação."
}
```

Resposta 201:

```json
{
  "id": "7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d",
  "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
  "jobId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  "status": "SAVED",
  "appliedAt": null,
  "resumeVersionId": null,
  "proposedSalaryCents": 950000,
  "offeredSalaryCents": null,
  "currency": "BRL",
  "salaryPeriod": "MONTH",
  "benefits": ["Plano de saúde", "Vale refeição"],
  "nextStepAt": "2026-11-25T14:00:00.000Z",
  "lastContactAt": null,
  "rejectionReason": null,
  "closedAt": null,
  "notes": "Candidatura enviada após indicação.",
  "createdAt": "2026-11-18T12:00:00.000Z",
  "updatedAt": "2026-11-18T12:00:00.000Z"
}
```

Exemplo de transição (`PATCH /v1/applications/7a8b.../status`):

```json
{ "status": "APPLIED", "note": "Enviada pelo LinkedIn." }
```

Exemplo de compensação (`PATCH /v1/applications/7a8b.../compensation`):

```json
{
  "offeredSalaryCents": 1100000,
  "currency": "BRL",
  "salaryPeriod": "MONTH",
  "benefits": ["Plano de saúde", "Vale refeição", "Auxílio home office"],
  "lastContactAt": "2026-11-20T16:30:00.000Z"
}
```

Exemplo de listagem
(`GET /v1/applications?status=APPLIED&companyId=1b2c...&from=2026-11-01&to=2026-11-18&page=1&limit=20`):

```json
{
  "data": [
    {
      "id": "7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d",
      "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
      "jobId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
      "status": "APPLIED",
      "appliedAt": "2026-11-18",
      "proposedSalaryCents": 950000,
      "offeredSalaryCents": 1100000,
      "currency": "BRL",
      "salaryPeriod": "MONTH",
      "benefits": ["Plano de saúde", "Vale refeição", "Auxílio home office"],
      "closedAt": null,
      "createdAt": "2026-11-18T12:00:00.000Z",
      "updatedAt": "2026-11-20T16:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Exemplo de histórico (`GET /v1/applications/7a8b.../history`):

```json
[
  {
    "id": "9c0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f",
    "applicationId": "7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d",
    "fromStatus": "SAVED",
    "toStatus": "APPLIED",
    "note": "Enviada pelo LinkedIn.",
    "changedAt": "2026-11-18T13:00:00.000Z"
  },
  {
    "id": "0d1e2f3a-4b5c-4d6e-8f70-8b9c0d1e2f3a",
    "applicationId": "7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d",
    "fromStatus": "APPLIED",
    "toStatus": "SCREENING",
    "note": null,
    "changedAt": "2026-11-19T10:15:00.000Z"
  }
]
```

Exemplo de erro de transição inválida:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid transition from HIRED. Allowed statuses: none",
  "path": "/v1/applications/7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d/status",
  "timestamp": "2026-11-22T09:00:00.000Z"
}
```

## Regras de negócio

1. **Ownership**: `userId` vem do JWT (`@CurrentUser()`); toda consulta e escrita é filtrada por ele. `userId`, `user_id`, `jobId` no body e `resumeVersionId` nesta sprint são rejeitados com 400. Recurso alheio ou inexistente responde **404**, nunca 403. Em filtro de listagem, `companyId` alheio devolve envelope vazio.
2. **Criação e unicidade**: o POST é feito em uma transação; `jobId` vem do path e deve ser uma vaga do mesmo usuário. `unique(user_id, job_id)` gera **409** na pré-checagem e em corrida (`ER_DUP_ENTRY`). O status inicial é sempre `SAVED`.
3. **Máquina de estados**: a única fonte de verdade é o mapa exportado `APPLICATION_TRANSITIONS`, com a matriz completa da spec `:180-194`:

   ```text
   APPLICATION_TRANSITIONS = {
     SAVED:     ['APPLIED', 'CANCELLED'],
     APPLIED:   ['SCREENING', 'SCHEDULED', 'REJECTED', 'GHOSTED', 'WITHDRAWN', 'CANCELLED'],
     SCREENING: ['SCHEDULED', 'INTERVIEW', 'REJECTED', 'GHOSTED', 'WITHDRAWN', 'CANCELLED'],
     SCHEDULED: ['INTERVIEW', 'REJECTED', 'GHOSTED', 'WITHDRAWN', 'CANCELLED'],
     INTERVIEW: ['OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN', 'CANCELLED'],
     OFFER:     ['HIRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
     GHOSTED:   ['SCREENING', 'SCHEDULED', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'],
     HIRED:     [],
     REJECTED:  [],
     WITHDRAWN: [],
     CANCELLED: []
   }
   ```

   Transição para o mesmo status é inválida. `GHOSTED` não é terminal. A mensagem de 400 lista os estados permitidos (ou `none` para terminais).
4. **Atomicidade e imutabilidade**: cada transição atualiza `application.status` e insere `application_status_history` na mesma transação, com bloqueio da linha da candidatura. O histórico é append-only: não há PATCH, DELETE, coluna `updated_at` nem sobrescrita de `changed_at`.
5. **Datas derivadas**: `appliedAt` é preenchido na primeira entrada em `APPLIED` e nunca é limpo. `closedAt` é preenchido ao entrar em `HIRED`, `REJECTED`, `WITHDRAWN` ou `CANCELLED`; `GHOSTED` não preenche. Datas `YYYY-MM-DD`; datetimes ISO 8601 UTC.
6. **Dinheiro**: centavos como inteiro `>= 0` e `<= Number.MAX_SAFE_INTEGER`, persistidos em `bigint unsigned` (string no driver) e expostos como número JSON. Toda candidatura tem `currency` (`/^[A-Z]{3}$/`, default herdado da vaga) e `salary_period` (enum, nunca `null`). Não há validação de relação entre proposto e ofertado.
7. **Benefits**: forma provisória é `json` com array de `string`; `null`/omitido é aceito e retornado como `null`. Qualquer outro tipo → 400 (Pendente 2).
8. **Filtros e paginação**: AND entre `status`, `companyId`, `from`, `to`; `page` default 1, `limit` default 20 e máximo 100. Envelope `{ data, meta }` com `totalPages = ceil(total / limit)` (0 quando `total = 0`). Ordenação fixa `createdAt DESC, id ASC`. `sort` e parâmetros fora da whitelist → 400.
9. **Respostas e erros**: criação 201, leitura/atualização 200. Nenhum DTO expõe dados de autenticação. Erros seguem o filtro global com mensagem indicando campo ou estados permitidos.
10. **Integração com a Sprint 3**: `jobs`, `companies` e `recruiters` são somente leitura aqui. `applications.job_id` usa `RESTRICT`; `DELETE /v1/jobs/:id` com candidatura → 409. `jobs.status` continua inexistente e `?status` em `GET /v1/jobs` continua 400.

## Modelo de dados

Migration versionada `1795046400000-CreateApplicationsDomain` criada e executada
localmente, sequencial após `1794960000000-CreatePipelineDomain`; `synchronize: false`
mantido. PKs `varchar(36)` com UUID, `created_at`/`updated_at` em `datetime(6)` na tabela
raiz, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`. A cadeia local
`run` → `revert` → `run` → `show` terminou com 4 migrations aplicadas e `schema:log` via
CLI sem drift. FKs com nomes explícitos idênticos em entidade e migration:
`FK_applications_user` (`CASCADE`), `FK_applications_job` (`RESTRICT`) e
`FK_application_status_history_application` (`CASCADE`).

| Tabela | Campos principais | Restrições e FKs |
|---|---|---|
| `applications` | `id`, `user_id`, `job_id`, `status enum`, `applied_at date NULL`, `resume_version_id varchar(36) NULL`, `proposed_salary_cents bigint unsigned NULL`, `offered_salary_cents bigint unsigned NULL`, `currency char(3) default 'BRL'`, `salary_period enum`, `benefits json NULL`, `next_step_at datetime(6) NULL`, `last_contact_at datetime(6) NULL`, `rejection_reason varchar(500) NULL`, `closed_at datetime(6) NULL`, `notes text NULL` | UNIQUE `(user_id, job_id)`; FK `user_id → users.id` `CASCADE`; FK `job_id → jobs.id` `RESTRICT`; `resume_version_id` sem FK nesta sprint (Pendente 1); índices `(user_id, created_at)`, `(user_id, status)` e `(job_id)`. A `UNIQUE` já cobre o prefixo `(user_id, job_id)`, sem índice redundante |
| `application_status_history` | `id`, `application_id`, `from_status enum NULL`, `to_status enum NOT NULL`, `note varchar(500) NULL`, `changed_at datetime(6) NOT NULL` | FK `application_id → applications.id` `CASCADE`; append-only (sem `updated_at`); índice `(application_id, changed_at, id)`. Nome **singular** decidido no ADR 0004, conforme a spec; não vira plural nesta sprint |

Enum novo (string enum em `src/common/enums/`, membro = próprio valor):

```text
ApplicationStatus:
  SAVED | APPLIED | SCREENING | SCHEDULED | INTERVIEW | OFFER |
  HIRED | REJECTED | WITHDRAWN | CANCELLED | GHOSTED
```

`SalaryPeriod` (`MONTH | YEAR | HOUR | DAY`) é reaproveitado da Sprint 3 e não deve ser
recriado. `resume_version` não existe até a Sprint 5; por isso `resume_version_id`
fica reservado, nullable e sem FK por enquanto (Pendente 1).

## Demo manual

**Não executada pelo time nesta execução — pendente para o humano.** Pré-condição:
MySQL local no Docker, `npm run migration:run`, `npm run seed:skills`,
`npm run start:dev` e Swagger em `/docs`. Use a branch `feat/sprint-2-profile`; não
criar branch nova nem commitar.

1. Registre dois usuários via `POST /v1/auth/register` e faça login para obter
   `TOKEN_A` e `TOKEN_B`. Guarde os `userId`s para conferir que nunca aparecem no body
   como campo aceito.
2. Como A, crie uma empresa e uma vaga com `POST /v1/companies` e `POST /v1/jobs`
   (contratos da Sprint 3). Guarde o `jobId`. Como B, tente
   `POST /v1/jobs/<jobId>/applications` → 404.
3. Como A, `POST /v1/jobs/<jobId>/applications` com o JSON de exemplo → 201 e
   `status: "SAVED"`. Repita o POST → 409. Tente enviar `status: "APPLIED"` no body →
   400; `resumeVersionId` → 400.
4. Sem header `Authorization`, repita `GET /v1/applications` → 401. Com `TOKEN_B`,
   faça `GET /v1/applications/<id>` da candidatura de A → 404.
5. Faça `PATCH /v1/applications/<id>/status` com
   `{"status":"APPLIED","note":"Enviada pelo LinkedIn."}` → 200, `appliedAt`
   preenchido e uma linha de histórico `SAVED → APPLIED`.
6. Percorra a sequência aprovada pela spec, confirmando o histórico após cada passo:
   `APPLIED → SCREENING` (com `note`), `SCREENING → SCHEDULED`,
   `SCHEDULED → INTERVIEW`, `INTERVIEW → OFFER` e `OFFER → HIRED`. Confirme que
   `closedAt` permanece `null` até `HIRED` e que `GHOSTED`, se testado à parte, não
   preenche `closedAt`.
7. Tente `PATCH .../status` com `{"status":"SCREENING"}` a partir de `HIRED` → 400 com
   mensagem `Allowed statuses: none`; confirme que o status continua `HIRED` e que
   nenhuma linha nova foi inserida no histórico.
8. `GET /v1/applications/<id>/history` → array ordenado com `changedAt` ASC; cada
   linha traz `fromStatus`, `toStatus`, `note` e `changedAt`. Confirme que não há rotas
   de `PATCH`/`DELETE` para o histórico (imutabilidade).
9. `PATCH /v1/applications/<id>/compensation` com `offeredSalaryCents: 1100000`,
   `currency: "BRL"`, `salaryPeriod: "MONTH"` e `benefits` → 200 com centavos como
   número JSON. Teste `offeredSalaryCents: -1`, `currency: null` e `salaryPeriod: "FOO"`
   → 400. Teste `benefits: null` → campo limpo.
10. `GET /v1/applications?status=HIRED&companyId=<id>&from=2026-11-01&to=2026-11-18&page=1&limit=20`
    → envelope `{ data, meta }`. Repita com `?sort=status:asc` → 400; com
    `?status=INVALID` → 400; com `companyId` de B → `total: 0`.
11. Tente `DELETE /v1/jobs/<jobId>` com a candidatura vinculada → 409; a vaga e a
    candidatura permanecem.
12. Com `TOKEN_B`, repita `GET`, `PATCH .../status`, `PATCH .../compensation` e
    `GET .../history` no `:id` de A → 404 em todos.

## Riscos

| Risco | Mitigação |
|---|---|
| Duas transições concorrentes deixando o histórico inconsistente | Transação única + bloqueio da linha; critério explícito; cobertura pendente para testes/demo |
| Histórico acidentalmente alterado por PATCH/DELETE | Contrato somente GET; sem `updated_at`; imutabilidade no DoD; verificação na demo |
| `applied_at`/`closed_at` preenchidos fora das regras | Critérios explícitos; `GHOSTED` fora da lista de terminais; demo passo 6 |
| Duplicata de candidatura em corrida | `unique(user_id, job_id)` + tradução de `ER_DUP_ENTRY` para 409 |
| `bigint` devolvido como string pelo driver | Conversão no mapper de resposta e string na persistência, reaproveitando `money.ts`; cenário na demo |
| Vazamento entre usuários | Toda query parte do `userId` do JWT; alheio por `:id` → 404; em filtro → envelope vazio; demo com dois usuários |
| `resume_version_id` sem tabela até a Sprint 5 | Coluna nullable reservada, fora da API; Pendente 1 |
| `benefits json` sem forma acordada | Array de strings provisório e reversível; Pendente 2 |
| `currency`/`salary_period` da candidatura divergentes da vaga | Default herdado no POST; validação explícita no PATCH; Pendente 3 |
| Semântica incerta de `from`/`to` | `created_at` proposto; `applied_at` fica para filtro futuro; Pendente 4 |
| `GET /v1/jobs/:id/application` citado na spec sem história aprovada | Fora de KAN-30; Pendente 5; não confundir com entrega concluída |
| `sort` da convenção geral sem aprovação nesta sprint | Rejeitado com 400, igual a sprint-03; Pendente 6 |
| `note` do histórico sem tamanho definido | `varchar(500)` nullable proposto; Pendente 7 |
| `DELETE` de candidatura ausente da spec | Fora de escopo; retirada é transição; nenhum 204; Pendente 8 |
| `RESTRICT` em `applications.job_id` mudando `DELETE /v1/jobs/:id` | Decisão registrada e passo 11 da demo; ajuste no `JobsService` da Sprint 3 |
| Ausência de testes, demo e commit nesta execução (desvio do DoD) | O humano deve executar unit/e2e, a demo completa e decidir commit/push/PR/merge |
| Branch única com Sprint 2 + Sprint 3 uncommitted | Risco de misturar escopos; humano decide commit ou separação; nenhuma branch nova criada pelo time |
| Verificar na demo/teste humano — mensagem de `sort` em runtime com `enableImplicitConversion` | Exceção documentada garante a mensagem rica para `sort`; conferir o corpo real do 400 com o pipe atual |
| Verificar na demo/teste humano — concorrência real do `pessimistic_write` | Disparar duas transições simultâneas; no máximo uma vence e a outra recebe 400 com os estados permitidos |
| Verificar na demo/teste humano — fragmento `UQ_applications_user_job` em `ER_DUP_ENTRY` | Confirmar que o texto do driver contém o nome da constraint; se não, ajustar o fragmento somente no bloco de criação |
| Verificar na demo/teste humano — `bigint` como number no JSON | Conferir centavos como número na resposta e string na persistência; acima de `MAX_SAFE_INTEGER`, a validação deve falhar com 400 |
| Verificar na demo/teste humano — corrida estreita entre `countBy` e `remove` em `JobsService` | `RESTRICT` no banco é a última linha de defesa; confirmar 409 consistente e nenhum 500 vazando SQL |
| Verificar na demo/teste humano — limites de `from`/`to` | Confirmar `[00:00:00.000000, 23:59:59.999999]` em UTC, datas inexistentes e `from > to` → 400 |

## Definition of Done

**Desvio explícito aprovado nesta execução (instrução do usuário):** TESTES (unitários e
e2e), DEMO MANUAL e COMMIT não foram escritos, executados ou feitos pelo time; o humano
fará ao final. Lint, `tsc`, build, `git diff --check`, revisão read-only e a cadeia local
de migration **foram executados** nesta execução; o desvio remanescente é somente
testes/demo/commit.

Itens concluídos nesta execução:

- [x] `docs/sprints/sprint-04.md` escrito com Escopo, Decisões, Resolução de conflitos, critérios Given/When/Then, contratos, exemplos, regras, modelo de dados, demo manual, riscos, DoD, tarefas e pendências.
- [x] KAN-30, KAN-31, KAN-32 e KAN-33 implementados conforme os critérios acima.
- [x] Enum `ApplicationStatus`, `APPLICATION_TRANSITIONS`, entidades `Application` e `ApplicationStatusHistory` (tabela no singular), DTOs, `ApplicationsService`, controller com 6 rotas, `ApplicationsModule`, Swagger e ajuste em `JobsService.remove` (409 quando a vaga tem candidatura).
- [x] Migration `1795046400000-CreateApplicationsDomain` criada; cadeia local `migration:run` → `migration:revert` → `migration:run` → `migration:show` concluída (4 aplicadas) e `schema:log` via CLI sem drift.
- [x] `npm run lint` (exit 0; warning preexistente em `test/auth.e2e-spec.ts:232`), `npx tsc --noEmit -p tsconfig.json` (exit 0), `npm run build` (exit 0) e `git diff --check` (exit 0).
- [x] Revisão read-only executada: correção de `currency`/`salaryPeriod` no POST, remoção da injeção morta de `jobsRepository` e exceção documentada para `?sort=`; ver Correções pós-revisão.
- [x] Swagger em `/docs` com endpoints e DTOs documentados, incluindo envelope paginado e exemplos desta sprint.
- [x] Nenhum segredo introduzido na implementação desta sprint; `.env` não lido.
- [x] Todo recurso escopado por `userId` do JWT; campos de ownership rejeitados com 400; recurso alheio/inexistente → 404.
- [x] `APPLICATION_TRANSITIONS` exportado como única fonte da máquina de estados; histórico append-only; criação sem linha de histórico (decisão 4).
- [x] Ajuste no `DELETE /v1/jobs/:id` para responder 409 quando houver candidatura vinculada.
- [x] Branch mantida em `feat/sprint-2-profile` (HEAD `00b0647`), sem branch nova, commit, push, PR, merge ou deploy.

Pendente para o humano (fora da execução do time, por decisão explícita):

- [ ] Executar a demo manual completa, incluindo a sequência `SAVED → APPLIED → SCREENING → SCHEDULED → INTERVIEW → OFFER → HIRED`, uma transição inválida, a verificação do histórico e o isolamento entre dois usuários.
- [ ] Escrever/executar testes unitários (inclusive a matriz de `APPLICATION_TRANSITIONS`) e e2e (`npm test` e `npm run test:e2e` com MySQL).
- [ ] Validar as ambiguidades da seção abaixo no portão final e ajustar o ADR 0004 se houver mudança.
- [ ] Decidir commit e eventual separação entre Sprint 2, Sprint 3 e Sprint 4; depois, fazer push, aprovar revisão/PR e merge/deploy.

## Tarefas

- [x] Escrever `docs/sprints/sprint-04.md` com critérios, contratos, regras, modelo de dados, demo, riscos e pendências — base do planejamento.
- [x] Architect: oito ambiguidades decididas no ADR 0004; a confirmação final fica com o humano (item pendente abaixo).
- [x] Migration versionada `1795046400000-CreateApplicationsDomain` de `applications` e `application_status_history` (singular), com `unique(user_id, job_id)`, FKs explícitos e índices; cadeia local `run` → `revert` → `run` → `show` executada e `schema:log` via CLI sem drift.
- [x] Enum `ApplicationStatus` e mapa exportado `APPLICATION_TRANSITIONS` criados.
- [x] Entidades, DTOs de request/response e query DTOs criados; nenhum DTO de request/query com `userId`.
- [x] `ApplicationsService` de criação implementado (ownership, 409, default `SAVED`, herança de `currency`/`salary_period`).
- [x] Transição de status transacional implementada com `applied_at`, `closed_at`, `note` e histórico append-only.
- [x] Compensação implementada com centavos em `bigint`, `benefits` e campos descritivos opcionais.
- [x] Filtros, paginação e envelope `{ data, meta }` de `GET /v1/applications` implementados, com `sort` rejeitado.
- [x] `JobsService` ajustado para 409 ao excluir vaga com candidatura vinculada.
- [x] Rotas e DTOs documentados no Swagger, incluindo os exemplos desta sprint.
- [x] `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `git diff --check` e a cadeia de migration executados com sucesso.
- [x] Revisão read-only executada; achados e decisão sobre `sort` registrados em Correções pós-revisão.
- [x] Manter tudo em `feat/sprint-2-profile`, sem branch nova e sem commit nesta execução.
- [ ] Humano/architect: validar as oito ambiguidades e registrar ajustes no ADR 0004, se houver.
- [ ] Humano: escrever/executar testes unitários e e2e.
- [ ] Humano: executar a demo manual completa e registrar o resultado na validação humana.
- [ ] Humano: decidir commit/PR/merge/deploy e eventual separação entre Sprints 2, 3 e 4.

## Pendente de validação humana/architect

As oito ambiguidades abaixo foram **decididas para implementação** no ADR 0004 e não
bloquearam o desenvolvimento: KAN-30 a KAN-33 foram implementados com essas propostas.
Nenhuma é requisito irreversível: o architect/humano confirma ou ajusta no portão final,
com ajuste no ADR 0004 se houver mudança.

1. **`resume_version_id` nullable e `resume_version` só na Sprint 5**
   - Proposta adotada: manter a coluna `resume_version_id varchar(36) NULL` no modelo, sem FK. `resumeVersionId` aparece **somente na resposta, sempre `null`**; `POST`, `PATCH` e query que o enviarem recebem `400`. A associação real vira história da Sprint 5, quando `resume_version` existir.
   - Pendente: confirmar no portão final se o campo deve continuar exposto como `null` na resposta ou se sai do DTO — nesse último caso, é quebra de contrato e exige ADR.

2. **`benefits json nullable`**
   - Proposta: array simples de strings (`["Plano de saúde", "Vale refeição"]`), com `null`/omitido aceito e retornado como `null`; item não-string → 400.
   - Pendente: confirmar se o produto quer objeto estruturado (por exemplo, `{ type, description }`), o que mudaria o DTO e o seed de demonstração.

3. **`currency`/`salary_period` da candidatura**
   - Proposta: ambos opcionais no POST; quando omitidos, herdam da vaga; quando informados, são validados (`/^[A-Z]{3}$/` e enum) e substituem o default; nunca `null`. No `PATCH .../compensation`, podem ser alterados explicitamente.
   - Pendente: confirmar se devem ser obrigatórios no POST ou se devem ser proibidos de divergir da vaga (travando a candidatura à moeda/periodicidade da origem).

4. **`from`/`to` em `GET /v1/applications`**
   - Proposta: filtrar por `created_at` (datetime UTC), com `YYYY-MM-DD` convertido para `[from 00:00:00.000000, to 23:59:59.999999]`; `from > to` → 400. `applied_at` fica disponível para um filtro futuro explícito (`appliedFrom`/`appliedTo`), não inventado aqui.
   - Pendente: confirmar se o humano prefere filtrar por `applied_at` (o que excluiria candidaturas ainda em `SAVED` de qualquer intervalo de datas).

5. **`GET /v1/jobs/:id/application` da spec `:404`**
   - Proposta: manter fora de KAN-30 e fora da Sprint 4. A listagem `GET /v1/applications` atende às histórias aprovadas; não existe filtro `jobId` na spec, portanto a rota por vaga não é substituída por um filtro inventado.
   - Pendente: confirmar se a rota deve virar história separada em E3 (com contrato próprio) ou se fica permanentemente fora do MVP.

6. **`sort=campo:asc|desc` da convenção `:431`**
   - Proposta: manter fora do escopo aprovado, como em sprint-03. `GET /v1/applications` usa ordenação fixa `createdAt DESC, id ASC`; `?sort=` → 400 com a lista de parâmetros suportados.
   - Pendente: confirmar se o humano quer adicionar uma história de `sort` com whitelist por recurso (mudança de contrato em mais de uma sprint).

7. **`note` no histórico**
   - Proposta: `varchar(500)`, `null` permitido; `note` omitida no PATCH de status vira `null`; acima de 500 caracteres → 400. Nenhum trim agressivo: o texto é preservado como enviado.
   - Pendente: confirmar se `note` deve ser obrigatória em algum status (por exemplo, `REJECTED`), o que mudaria o DTO e a regra de 400.

8. **Exclusão de candidatura (`DELETE`)**
   - Proposta: fora de KAN-30 e fora da sprint, pois a spec não lista `DELETE /v1/applications/:id`. Retirada/cancelamento é feito por transição para `WITHDRAWN` ou `CANCELLED`, preservando o histórico. Nenhuma rota retorna 204 nesta sprint.
   - Pendente: confirmar se o CRUD implícito de KAN-30 deve incluir exclusão física/lógica; se sim, é nova história com regras de retenção do histórico.
