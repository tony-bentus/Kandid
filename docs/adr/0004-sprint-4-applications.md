# ADR 0004 — Modelo de dados e contratos da Sprint 4 (candidaturas, máquina de estados e histórico)

- Status: Accepted
- Data: 2026-11-18
- Autores: tech lead (confirmações e resolução de conflitos) e architect (parecer, validação de modelo/contratos e registro)
- Parecer: aprovado com ajustes — decisões do tech lead adotadas para implementação; dois pontos divergem da proposta original do product-owner (`application_status_history` no singular e `resumeVersionId` exposto na resposta como `null`)
- Branch e escopo: `feat/sprint-2-profile`, HEAD `00b0647`; KAN-30 a KAN-33 (`docs/sprints/sprint-04.md`), Fase 2 da spec (`docs/prompt-kandid.md:508-514`). Sprint 2, Sprint 3 e a implementação da Sprint 4 seguem juntos e **uncommitted**; nenhuma branch nova é criada.
- Fechamento local: 2026-11-18 — ADR de decisão que passou a documentar uma **implementação validada estaticamente**, não apenas uma decisão. KAN-30 a KAN-33 foram implementados, com lint/`tsc`/build/`git diff --check` verdes e cadeia local de migration executada. Este ADR, por si, não executa código: testes, demo manual e decisão de commit/push/PR/merge/deploy ficam com o humano.

## Contexto e problema

A Sprint 4 fecha a Fase 2 com quatro histórias: KAN-30 (criar candidatura), KAN-31
(transicionar status com histórico), KAN-32 (registrar valores propostos/ofertados) e
KAN-33 (filtrar e paginar) (`docs/sprints/sprint-04.md:16-29`). A fonte da verdade do
domínio é `docs/prompt-kandid.md`, especialmente `:80-84` (convenções), `:138-145`
(entidades `application` e `application_status_history`), `:178-204` (máquina de
estados), `:374-434` (API e convenções) e `:508-514` (Fase 2).

O `docs/sprints/sprint-04.md:553-590` levantou oito ambiguidades e o tech lead decidiu
as divergências entre a spec, o sprint-04 e o ADR 0003. Este ADR registra essas
decisões como **Accepted** para liberar o backend-dev, preservando os padrões já
validados nas sprints anteriores:

- migrations versionadas e `synchronize: false`; cadeia local termina em
  `1794960000000-CreatePipelineDomain` (`docs/adr/0003-sprint-3-pipeline.md:304-407`);
- tabelas em **plural** como regra geral (`companies`, `jobs`, `job_skills`), com a
  exceção explícita registrada abaixo;
- `userId` sempre de `@CurrentUser()`/`sub` do JWT; `ValidationPipe` com
  `whitelist`/`forbidNonWhitelisted` (`docs/prompt-kandid.md:428`);
- `hasField`/`assertNoForcedNull` para PATCH e `normalizeOptionalString` para opcionais
  (`src/common/utils/null-fields.ts`);
- `isDuplicateEntry(error, fragmento)` para traduzir **somente** a constraint conhecida
  (`src/common/utils/is-duplicate-entry.ts`, ADR 0002 decisão 6);
- `money.ts` com `fieldName` opcional, preservando as mensagens de `desiredSalaryCents`
  (ADR 0003 decisão 5);
- enums como string enums em `src/common/enums/`, membro = próprio valor;
- datas `YYYY-MM-DD` para `date`, ISO 8601 UTC para `datetime`;
- erros no formato único `{ statusCode, error, message, path, timestamp }`.

As decisões abaixo são de implementação adotadas. As oito ambiguidades permanecem
sujeitas ao **portão final humano** (revisão, testes, demo e decisão de commit), sem
bloquear o desenvolvimento — o mesmo regime usado no ADR 0003
(`docs/adr/0003-sprint-3-pipeline.md:553-569`).

## Resolução de conflitos (tech lead, 2026-11-18)

O tech lead decidiu os pontos em que spec, `sprint-04.md` e ADR 0003 divergem. A
implementação segue **esta tabela**; onde houver divergência de redação, prevalece a
decisão adotada.

| # | Tema | Fontes em conflito | Decisão adotada | Justificativa verificável |
|---|---|---|---|---|
| 1 | Nome da tabela de histórico | Spec `:141-142` usa `application_status_history` (singular); convenção do ADR 0003 `:19-20` e `sprint-04.md:414` usavam plural na proposta inicial | **`application_status_history` no singular**, exatamente como a spec nomeia | Nome canônico; imutabilidade do histórico; evita `rename` e retrabalho de nomenclatura. Exceção registrada como as exceções de FK do ADR 0003 `:398-407` |
| 2 | `resume_version_id` | `sprint-04.md:87,108-109` diz “fora da API”, mas o exemplo de 201 em `:254` já mostra `resumeVersionId: null` | **`resumeVersionId` somente na resposta, como `null`**; ausente de request/query; coluna nullable reservada, sem FK até a Sprint 5 | Resolve a contradição com o exemplo de 201; contrato estável para a Sprint 5. Envio em POST/PATCH/query → `400` |
| 3 | `benefits` | Pendente 2 cogita objeto `{ type, description }`; proposta é array simples | **Array de strings**, `null`/omitido aceito e retornado como `null`; item não-string → `400`. Provisório | Forma reversível sem mudança de schema; objeto estruturado exige nova história/ADR |
| 4 | `currency` / `salaryPeriod` | Spec `:80,:138` obriga; pendente 3 cogita obrigar no POST ou proibir divergência | **Opcionais no POST, herdam da vaga quando omitidos; `null` → `400`; PATCH permite alteração explícita** | Unidade sempre presente na entidade (`NOT NULL`), sem travar a candidatura à origem. Reusa `SalaryPeriod` e `/^[A-Z]{3}$/` |
| 5 | `from` / `to` | Spec `:407` lista sem semântica; pendente 4 cogita `applied_at` | **`created_at` UTC**, `YYYY-MM-DD` → `[00:00:00.000000, 23:59:59.999999]`; `from > to` → `400`; `appliedFrom`/`appliedTo` ficam como ideia futura, fora de escopo | Toda candidatura tem `created_at`; `applied_at` é nulo até `APPLIED`, então filtrar por ele excluiria `SAVED` |
| 6 | `GET /v1/jobs/:id/application` | Spec `:404` cita; `sprint-04.md:117-118` propõe fora | **Fora da Sprint 4**; vira história separada em E3; **sem filtro `jobId` inventado** | A listagem aprovada é `GET /v1/applications`; não criar contrato sem história Given/When/Then |
| 7 | `sort=campo:asc\|desc` | Spec `:431` prevê; ADR 0003 `:62,224` e `sprint-04.md:83` rejeitam | **Fora de escopo**; `?sort=` → `400` listando os parâmetros suportados; ordem fixa `createdAt DESC, id ASC` | Mesmo critério aprovado na Sprint 3; ordenação configurável exigiria mudança de contrato em mais de uma sprint |
| 8 | `note` do histórico | Pendente 7 sem tamanho definido nem obrigatoriedade | **`varchar(500)` nullable, sem trim agressivo, não obrigatória em nenhum status nesta sprint** | Tamanho limita storage; texto preservado como enviado; obrigatoriedade (ex.: `REJECTED`) é mudança de DTO e de regra de `400` |
| 9 | `DELETE /v1/applications/:id` | CRUD implícito vs `sprint-04.md:119-120` | **Fora de escopo; nenhum `204` nas rotas de `applications`**; retirada/cancelamento via transição para `WITHDRAWN` ou `CANCELLED` | Preserva o histórico. `DELETE /v1/jobs/:id` continua com `204` quando não há candidatura (contrato da Sprint 3) |
| 10 | Linha de histórico na criação | Spec `:199` fala “ao transicionar”; pendente 4 do sprint marca criação sem linha | **Criação não gera linha**; primeira linha na primeira transição, com `fromStatus = SAVED`; `from_status` permanece nullable. Decisão **provisória**, sujeita ao portão final | `createdAt` já registra a criação; coluna nullable reservada para importação/estado desconhecido |
| 11 | `GHOSTED` e datas derivadas | Matriz da spec `:189-193` permite sair de `GHOSTED` | **`GHOSTED` não é terminal e não preenche `closedAt`**; terminais exatos: `HIRED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`; `appliedAt` preenchido na primeira entrada em `APPLIED` | Critério diretamente verificável pela matriz e pela demo da Fase 2 (spec `:514`) |
| 12 | FK `applications.job_id` | ADR 0003 `:398-407` adotou `RESTRICT` em `jobs.company_id`; sprint decide o mesmo para candidatura | **`ON DELETE RESTRICT` + checagem no `JobsService.remove` → `409` antes de deletar** | Evita candidatura órfã e perda de rastro da vaga; coerente com a Sprint 3. DB é a última linha de defesa; service dá o código de negócio |
| 13 | Unicidade, ownership e corpo do POST | Spec `:139` (unique) e `:429` (ownership); critérios do KAN-30 | **`unique(user_id, job_id)` → `409`, inclusive em corrida via `ER_DUP_ENTRY`; vaga alheia/inexistente no POST → `404`; `jobId` vem do path; `userId`, `user_id`, `jobId`, `status`, `appliedAt`, `closedAt`, `resumeVersionId` no body → `400`** | `409` explícito não esconde duplicata; `404` não revela existência; `whitelist` impede campo de ownership ou estado inicial forçado |
| 14 | Transição de status | Spec `:198-202` exige mapa único e mesma transação | **Transação única com `pessimistic_write` na linha da candidatura**; falha → nada escrito; inválida → `400` com `Invalid transition from X. Allowed statuses: ...` (ou `none`); histórico append-only sem `updated_at` | No máximo uma transição concorrente vence; a perdedora reavalia o status persistido e recebe `400`, nunca `500` |
| 15 | Dinheiro | Spec `:80` e ADR 0003 `:178-207` | **`bigint unsigned` (string no driver, número na resposta), `currency`/`salaryPeriod` obrigatórios na entidade; reaproveitar `money.ts` com `fieldName`** | Mensagens corretas por campo; nenhum arredondamento acima de `MAX_SAFE_INTEGER` |
| 16 | Filtros e paginação | Spec `:407,:430`; ADR 0003 `:208-242` | **Exatamente `status`, `companyId`, `from`, `to`, `page`, `limit`; `companyId` alheio/inexistente → envelope vazio; por `:id` → `404`; `page` default 1, `limit` default 20/máx 100; `totalPages = 0` quando vazio** | Filtro de coleção só estreita resultados; `404` fica reservado a `:id` |
| 17 | `userId` no DTO | `sprint-04.md:507` diz “nenhum DTO com `userId`”, mas `:153,:250` exigem `userId` igual ao `sub` na resposta | **Nenhum DTO de request/query declara `userId`; `ApplicationResponseDto` expõe `userId` somente como leitura** | Reconcilia a regra de ownership com o critério de aceite e o exemplo de 201 |
| 18 | Branch e responsabilidades | `AGENTS.md:50-59`; `sprint-04.md:4,62-68,128-151` | **Manter `feat/sprint-2-profile` em `00b0647`; testes, demo e commit ficam com o humano** | Evita separar trabalho uncommitted das Sprints 2/3 e respeita a regra de parada antes de commit |

## Decisão

### 1 — Modelo de dados (migration criada e executada localmente)

Migration `1795046400000-CreateApplicationsDomain` (classe
`CreateApplicationsDomain1795046400000`), sequencial após
`1794960000000-CreatePipelineDomain`, **criada e aplicada localmente**. `synchronize: false`
permanece. A cadeia `migration:run` → `migration:revert` → `migration:run` →
`migration:show` terminou com 4 migrations aplicadas; detalhes em
`docs/sprints/sprint-04.md`.

Padrões: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
`id varchar(36)` com `@PrimaryGeneratedColumn('uuid')`, `created_at`/`updated_at`
`datetime(6)` na tabela raiz. FKs com nomes explícitos idênticos em entidade e migration:
`FK_applications_user` (`CASCADE`), `FK_applications_job` (`RESTRICT`) e
`FK_application_status_history_application` (`CASCADE`).

**`applications`**

```text
id                       varchar(36) NOT NULL PK
user_id                  varchar(36) NOT NULL
job_id                   varchar(36) NOT NULL
status                   enum('SAVED','APPLIED','SCREENING','SCHEDULED','INTERVIEW',
                              'OFFER','HIRED','REJECTED','WITHDRAWN','CANCELLED','GHOSTED') NOT NULL
applied_at               date NULL
resume_version_id        varchar(36) NULL          -- reservada; SEM FK até a Sprint 5
proposed_salary_cents    bigint unsigned NULL
offered_salary_cents     bigint unsigned NULL
currency                 char(3) NOT NULL DEFAULT 'BRL'
salary_period            enum('MONTH','YEAR','HOUR','DAY') NOT NULL
benefits                 json NULL                 -- array de strings, provisório
next_step_at             datetime(6) NULL
last_contact_at          datetime(6) NULL
rejection_reason         varchar(500) NULL
closed_at                datetime(6) NULL
notes                    text NULL
created_at/updated_at    datetime(6) NOT NULL

UNIQUE INDEX UQ_applications_user_job (user_id, job_id)
FK applications.user_id -> users.id ON DELETE CASCADE ON UPDATE NO ACTION
FK applications.job_id  -> jobs.id  ON DELETE RESTRICT ON UPDATE NO ACTION
INDEX IX_applications_user_created (user_id, created_at)
INDEX IX_applications_user_status  (user_id, status)
INDEX IX_applications_job_id       (job_id)
```

- A `UNIQUE (user_id, job_id)` já indexa o prefixo `(user_id, job_id)` previsto no
  `sprint-04.md:413`; **não criar** `IX_applications_user_job` redundante. Critério:
  `SHOW INDEX` e `schema:log` não apontam índice duplicado.
- `IX_applications_job_id (job_id)` é declarado explicitamente para o `join` com
  `jobs` no filtro `companyId` e para atender a FK sem depender de índice implícito.
- `resume_version_id` fica nullable e **sem FK** porque `resume_version` só existe na
  Sprint 5. A associação vira história própria; não inventar FK agora.

**`application_status_history` (singular — exceção de nomenclatura)**

```text
id               varchar(36) NOT NULL PK
application_id   varchar(36) NOT NULL
from_status      enum(11 valores de ApplicationStatus) NULL
to_status        enum(11 valores de ApplicationStatus) NOT NULL
note             varchar(500) NULL
changed_at       datetime(6) NOT NULL

FK application_status_history.application_id -> applications.id ON DELETE CASCADE ON UPDATE NO ACTION
INDEX IX_application_status_history_app_changed (application_id, changed_at, id)
```

- **Sem `updated_at`**, sem `UPDATE`, sem `DELETE` e sem rota de alteração: append-only
  conforme `docs/prompt-kandid.md:83,141-142`.
- `from_status` continua **nullable** mesmo com a decisão provisória de que a primeira
  linha use `SAVED` (reservado para importação/estado desconhecido).
- `note` é `varchar(500) NULL`, preservado como enviado (sem trim agressivo); `> 500` →
  `400`.

**Exceção de nomenclatura registrada.** A regra geral do ADR 0003 `:19-20` é tabela em
plural. Aqui ela é explicitamente excecionada: o nome canônico da spec é
`application_status_history`, a tabela é imutável e um `rename` posterior geraria
migration e retrabalho sem ganho funcional. Registro análogo ao das exceções de FK no
ADR 0003 `:398-407`. Se o produto quiser plural no futuro, é nova ADR + migration de
rename, não uma alteração silenciosa nesta sprint.

**Exceções de FK nesta sprint:** `user_id` e `application_id` usam `CASCADE`
(propriedade, padrão do projeto); `job_id` usa `RESTRICT` (auditoria da vaga);
`resume_version_id` não tem FK. Critério verificável: `DELETE /v1/jobs/:id` com
candidatura vinculada retorna `409` e a vaga permanece.

### 2 — Enums e mapa `APPLICATION_TRANSITIONS`

Novo enum em `src/common/enums/application-status.enum.ts` (string enum, membro = próprio
valor):

```text
ApplicationStatus:
  SAVED | APPLIED | SCREENING | SCHEDULED | INTERVIEW | OFFER |
  HIRED | REJECTED | WITHDRAWN | CANCELLED | GHOSTED
```

`SalaryPeriod` (`MONTH | YEAR | HOUR | DAY`) é **reaproveitado** da Sprint 3
(`src/common/enums/salary-period.enum.ts`) e não deve ser recriado.

Fonte única da máquina (exportada, tipada como `Record<ApplicationStatus, ApplicationStatus[]>`,
sem `any`):

```ts
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

- Transição para o mesmo status é inválida (`SAVED -> SAVED` → `400`).
- Terminais exatos: `HIRED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`. `GHOSTED` **não** é
  terminal; a saída `GHOSTED -> CANCELLED` não existe na matriz e deve ser rejeitada.
- `appliedAt`: preenchido ao entrar em `APPLIED` se estiver vazio; nunca limpo.
- `closedAt`: preenchido ao entrar em qualquer terminal; `GHOSTED` mantém `null`.

### 3 — Contratos HTTP

Prefixo global `/v1`, Swagger em `/docs`, `Authorization: Bearer <jwt>` obrigatório em
todas as rotas (sem header → `401`). `userId` vem do JWT. Erros seguem
`{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros principais |
|---|---|---|---|---|
| POST | `/v1/jobs/:id/applications` | `CreateApplicationDto` | `201` + `ApplicationResponseDto` | `400`, `401`, `404` (vaga alheia/inexistente), `409` (`unique`) |
| GET | `/v1/applications` | Query: **`status`, `companyId`, `from`, `to`, `page`, `limit`** | `200` + `{ data, meta }` | `400` (inclusive `sort`), `401` |
| GET | `/v1/applications/:id` | — | `200` + `ApplicationResponseDto` | `400` (UUID), `401`, `404` |
| PATCH | `/v1/applications/:id/status` | `UpdateApplicationStatusDto` `{ status, note? }` | `200` + `ApplicationResponseDto` | `400`, `401`, `404` |
| PATCH | `/v1/applications/:id/compensation` | `UpdateApplicationCompensationDto` | `200` + `ApplicationResponseDto` | `400`, `401`, `404` |
| GET | `/v1/applications/:id/history` | — | `200` + `ApplicationStatusHistoryResponseDto[]` | `400` (UUID), `401`, `404` |

Não há `DELETE /v1/applications/:id`, nem qualquer `204` nestas seis rotas.
`GET /v1/jobs/:id/application` não é entregue (item 6 da tabela de conflitos).

**DTOs e formatos**

- `CreateApplicationDto`: `proposedSalaryCents?`, `offeredSalaryCents?`, `currency?`,
  `salaryPeriod?`, `benefits?`, `nextStepAt?`, `lastContactAt?`, `rejectionReason?`
  (máx. 500), `notes?`. Rejeitar com `400`: `jobId`, `userId`, `user_id`, `status`,
  `appliedAt`, `closedAt`, `resumeVersionId` e qualquer campo fora da whitelist.
- `ApplicationResponseDto`: `id`, `userId` (somente leitura, igual ao `sub`), `jobId`,
  `status`, `appliedAt` (`YYYY-MM-DD` ou `null`), **`resumeVersionId: null`**,
  `proposedSalaryCents`, `offeredSalaryCents`, `currency`, `salaryPeriod`, `benefits`,
  `nextStepAt`, `lastContactAt`, `rejectionReason`, `closedAt`, `notes`, `createdAt`,
  `updatedAt`. Centavos como **número JSON**; datetimes em ISO 8601 UTC. O `userId`
  aparece na resposta apesar da regra “nenhum DTO com `userId`” do plano — a regra vale
  para request/query (item 17 da tabela de conflitos).
- `UpdateApplicationStatusDto`: `status` obrigatório e dentro de `ApplicationStatus`;
  `note?` com no máximo 500 caracteres, `null` aceito e persistido como `null`; sem
  trim agressivo. `status: null`, ausente ou fora do enum → `400`.
- `UpdateApplicationCompensationDto`: subconjunto de `proposedSalaryCents`,
  `offeredSalaryCents`, `currency`, `salaryPeriod`, `benefits`, `notes`, `nextStepAt`,
  `lastContactAt`, `rejectionReason`. Campos ausentes permanecem inalterados
  (`hasField`); `null` limpa apenas os opcionais descritivos e `benefits`. `currency`
  e `salaryPeriod` `null` → `400`. Rejeitar `status`, `userId`, `user_id`,
  `resumeVersionId` e campos fora da whitelist. **Não existe** `PATCH /v1/applications/:id`.
  Não há regra `proposed <= offered` nesta sprint.
- `ApplicationStatusHistoryResponseDto`: `id`, `applicationId`, `fromStatus`,
  `toStatus`, `note`, `changedAt` (ISO 8601 UTC). Sem `userId`. Ordenação fixa:
  `changedAt ASC, id ASC`.
- `QueryApplicationDto`: somente os seis parâmetros da tabela. `?sort=` e qualquer outro
  parâmetro fora da whitelist → `400`; `sort` devolve a mensagem com a lista de
  suportados (ver exceção documentada abaixo). `resumeVersionId` em query → `400`.
- `resumeVersionId` **nunca** é aceito em request nem query; aparece apenas na resposta
  como `null` (decisão 2).

**Exceção documentada — parâmetros de query (decisão do tech lead):** qualquer parâmetro
fora da whitelist de `GET /v1/applications` continua retornando `400` pelo
`forbidNonWhitelisted` global; o `ValidationPipe` global **não** foi alterado. A mensagem
rica `Unsupported query parameters: sort. Supported: status, companyId, from, to, page, limit`
é garantida explicitamente para `sort`, o caso exemplificado neste ADR e no sprint-04;
outros parâmetros desconhecidos podem usar a mensagem padrão do pipe. É exceção
documentada, não pendência de código. O comportamento em runtime com
`enableImplicitConversion` segue para verificação humana (demo/testes).

Exemplos de erro (formato único):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid transition from HIRED. Allowed statuses: none",
  "path": "/v1/applications/7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d/status",
  "timestamp": "2026-11-22T09:00:00.000Z"
}
```

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Application already exists for this job",
  "path": "/v1/jobs/1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d/applications",
  "timestamp": "2026-11-18T12:00:00.000Z"
}
```

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Unsupported query parameters: sort. Supported: status, companyId, from, to, page, limit",
  "path": "/v1/applications",
  "timestamp": "2026-11-18T12:00:00.000Z"
}
```

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "from must be before or equal to to",
  "path": "/v1/applications",
  "timestamp": "2026-11-18T12:00:00.000Z"
}
```

### 4 — Regras de transação e atomicidade

**Criação (KAN-30).** Transação única: validar que a vaga pertence ao `userId` do JWT
(`where: { id, userId }`; ausência → `404`), inserir a candidatura com `status = SAVED`,
`appliedAt = null`, `closedAt = null` e `resume_version_id = null`. Pré-checagem de
`unique(user_id, job_id)` → `409`; corrida detectada por
`isDuplicateEntry(error, 'UQ_applications_user_job')` → `409` na mesma mensagem, sem
segunda linha. **Nenhuma linha de histórico é gravada na criação** (decisão provisória
do item 10).

**Transição (KAN-31).** Em uma única transação:

1. adquirir `pessimistic_write` na linha de `applications` por `id` **e** `userId`;
2. reler o `status` persistido dentro da transação e validar contra
   `APPLICATION_TRANSITIONS`;
3. se inválido → `BadRequestException` com
   `Invalid transition from X. Allowed statuses: ...` (`none` para terminais), sem
   nenhuma escrita;
4. se válido → atualizar `status`, preencher `appliedAt` na primeira entrada em
   `APPLIED`, preencher `closedAt` nos terminais exatos, e inserir
   `application_status_history` com `fromStatus = status anterior`, `toStatus = alvo`,
   `note` e `changedAt = agora`;
5. commit. Falha em qualquer escrita reverte as duas.

Concorrência: no máximo uma das duas requisições vence; a outra obtém o status já
persistido e recebe `400` com os estados permitidos a partir dele — nunca `500` e nunca
duas linhas de histórico para o mesmo `from -> to` concorrente. O histórico é
append-only: sem `updated_at`, sem `UPDATE`, sem `DELETE`, sem rota de alteração.

### 5 — Dinheiro e benefits

- Centavos: inteiro `>= 0` e `<= Number.MAX_SAFE_INTEGER` no DTO; persistência em
  `bigint unsigned` (o driver devolve string); resposta como `number` via `money.ts`.
  Reaproveitar `bigintCentsToNumber(raw, 'proposedSalaryCents' | 'offeredSalaryCents')`
  e `numberToBigintCents(value, fieldName)`; `RangeError` → `400` com mensagem contendo
  o nome do campo. Acima do limite, falha em vez de arredondar.
- `currency`: `/^[A-Z]{3}$/`, `char(3) NOT NULL DEFAULT 'BRL'`. `salaryPeriod`: enum
  reaproveitado, `NOT NULL`. Ambos são **obrigatórios na entidade**.
- POST: opcionais; se omitidos, herdam da vaga (`jobs.currency`,
  `jobs.salary_period`); se informados, validados e usados no lugar do default; `null`
  em qualquer um → `400`. PATCH de compensação: podem ser alterados explicitamente.
- Validação é apenas sintática para moeda (`XYZ` passa; catálogo ISO 4217 fora de
  escopo, risco R4 do ADR 0003).
- `benefits`: `json NULL` com array de strings; `null`/omitido → `null`; item
  não-string → `400` antes da escrita; no PATCH, um array substitui o anterior e `null`
  limpa. **Provisório**: objeto estruturado exigiria nova história e ADR.

### 6 — Filtros e paginação

- Whitelist exata: `status`, `companyId`, `from`, `to`, `page`, `limit`. `status` fora
  do enum → `400`. Relação é **AND** entre os filtros.
- `companyId` de empresa alheia ou inexistente → envelope vazio (`total: 0`,
  `totalPages: 0`), sem `404`; recurso por `:id` alheio/inexistente → `404`.
- `from`/`to`: datas `YYYY-MM-DD` válidas em UTC, convertidas para
  `[00:00:00.000000, 23:59:59.999999]` sobre `applications.created_at`. Formato
  inválido, data inexistente ou `from > to` → `400`. `appliedAt` não é usado aqui;
  `appliedFrom`/`appliedTo` ficam registrados como ideia futura, fora de escopo.
- `page` default `1`; `limit` default `20`, `1 <= limit <= 100`; fora disso → `400`.
- `totalPages = Math.ceil(total / limit)`, com `0` quando `total === 0`. Página além
  do fim → `200` com `data: []` e `meta` correto.
- Ordenação fixa e estável: `createdAt DESC, id ASC`. `sort` configurável está fora do
  escopo; `?sort=` → `400` (item 7).

### 7 — Integração com a Sprint 3 (ajuste no `DELETE /v1/jobs/:id`)

`jobs`, `companies` e `recruiters` são **somente leitura** na Sprint 4. Nenhuma
alteração em `jobs.status`: `?status` em `GET /v1/jobs` continua rejeitado com `400`
(ADR 0003 `:232-238`), e o `status` do domínio passa a existir apenas em
`GET /v1/applications`.

`applications.job_id -> jobs.id` usa `ON DELETE RESTRICT`. O `JobsService.remove` da
Sprint 3 passa a checar candidaturas vinculadas **antes** de excluir e responde `409`
com mensagem indicando a dependência; a vaga permanece. Isso mantém a auditoria e é
coerente com `jobs.company_id -> companies.id ON DELETE RESTRICT` do ADR 0003. O
sucesso do `DELETE /v1/jobs/:id` continua sendo `204` quando **não** há candidatura —
a restrição de “nenhum 204” deste ADR vale somente para as rotas de `applications`.

## Validação local da implementação (2026-11-18)

Resultados reportados pelo backend-dev na branch `feat/sprint-2-profile`, HEAD `00b0647`,
após a implementação de KAN-30 a KAN-33. Este ADR continua sendo registro de decisão; a
tabela registra o que foi executado fora dele.

| Comando / verificação | Resultado |
|---|---|
| `npm run lint` | exit 0; único warning preexistente em `test/auth.e2e-spec.ts:232` |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |
| `npm run migration:run` → `npm run migration:revert` → `npm run migration:run` → `npm run migration:show` | cadeia concluída: 1ª aplicação, revert, nova aplicação e 4 migrations aplicadas ao final, incluindo `1795046400000-CreateApplicationsDomain` |
| Drift de schema | `npm run typeorm -- schema:log -d src/database/data-source.ts` → “Your schema is up to date - there are no queries to be executed by schema synchronization”, exit 0 |
| Testes unitários/e2e | nenhum teste escrito ou executado; responsabilidade humana |
| Demo manual | não executada; responsabilidade humana |
| Revisão de código | revisão read-only: `currency`/`salaryPeriod: null` no POST corrigidos com `@ValidateIf(value !== undefined)` em `CreateApplicationDto`; injeção morta de `jobsRepository` removida de `ApplicationsService`/`ApplicationsModule`; decisão sobre `sort` registrada em Contratos |
| Git | nenhum commit, push, PR, merge, release ou deploy; alterações seguem uncommitted em `00b0647` |

Nota: `npm run schema:log` **não existe** em `package.json`. O drift foi conferido pelo
CLI direto (`npm run typeorm -- schema:log -d src/database/data-source.ts`), não por um
script npm próprio.

## Alternativas consideradas

| Tema | Alternativa | Prós | Contras / por que não |
|---|---|---|---|
| Nome da tabela de histórico | **Singular, como a spec (escolhida)** | Nome canônico; sem rename; coerente com imutabilidade | Quebra a regra geral de plural; exceção registrada no ADR |
| Nome da tabela de histórico | `application_status_histories` | Uniformidade com `companies`/`jobs` | Migration de rename e divergência da spec sem ganho funcional |
| `resumeVersionId` | **Só na resposta, `null` (escolhida)** | Casa com o exemplo de 201; estável para Sprint 5 | Exige lembrar de rejeitá-lo em request/query |
| `resumeVersionId` | Fora da API, como diz o texto do sprint | Sem campo “falso” no contrato | Contradiz o próprio exemplo de 201 do sprint-04 |
| `resumeVersionId` | Aceito no POST/PATCH | Permite vincular versão já na criação | `resume_version` não existe; aceitar UUID órfão criaria dívida de integridade |
| `benefits` | **Array de strings (escolhida, provisória)** | Simples, reversível, sem schema extra | Produto pode querer objeto estruturado depois |
| `benefits` | `{ type, description }[]` | Mais rico para dashboards | Muda DTO, validação e seed; sem história aprovada |
| `currency`/`salaryPeriod` | **Opcionais no POST com herança (escolhida)** | Cadastro rápido; unidade nunca nula na entidade | Candidatura pode divergir da vaga; aceito nesta sprint |
| `currency`/`salaryPeriod` | Obrigatórios no POST | Sempre explícitos | Repete dado da vaga e contraria pendente 3 |
| `currency`/`salaryPeriod` | Proibidos de divergir da vaga | Fonte única | Impede registrar proposta em outra moeda; regra nova fora da spec |
| `from`/`to` | **`created_at` UTC (escolhida)** | Toda candidatura tem o campo; não exclui `SAVED` | Não responde “quando foi aplicado”; `appliedFrom`/`appliedTo` ficam para depois |
| `from`/`to` | `applied_at` | Semântica de aplicação | Exclui `SAVED` de todo intervalo; `applied_at` é nulo até `APPLIED` |
| `GET /v1/jobs/:id/application` | **Fora da sprint (escolhida)** | Sem contrato inventado; foco nas histórias aprovadas | Spec `:404` continua sem implementação até história em E3 |
| `GET /v1/jobs/:id/application` | Filtro `?jobId=` em `/applications` | Reusa listagem existente | Parâmetro não especificado; ampliaria whitelist sem aprovação |
| `sort` | **Rejeitar com `400` (escolhida)** | Igual à Sprint 3; ordenação determinística | Spec `:431` prevê `sort`; depende de confirmação humana |
| `sort` | Whitelist por recurso | Flexível | Mudança de contrato em várias sprints de uma vez |
| `note` | **`varchar(500)` nullable, sem trim (escolhida)** | Texto preservado; limite conhecido | Obrigatoriedade por status exigiria nova regra de `400` |
| `note` | Obrigatória em `REJECTED` | Mais contexto para auditoria | Fora dos critérios Given/When/Then aprovados |
| Exclusão | **Transição para `WITHDRAWN`/`CANCELLED` (escolhida)** | Histórico preservado; sem 204 em applications | Não apaga dados; exclusão física/lógica precisaria de retenção |
| Exclusão | `DELETE /v1/applications/:id` | CRUD “completo” | Fora da spec de API; apagaria rastro sem política de retenção |
| Histórico na criação | **Nenhuma linha; primeira em `SAVED -> ...` (escolhida, provisória)** | `createdAt` já registra a criação; `from_status` nullable continua útil | Auditoria não mostra o estado inicial como linha; portão final pode rever |
| Histórico na criação | Inserir `null -> SAVED` | Histórico completo desde o início | Contraria “ao transicionar” da spec e cria linha artificial |
| FK `job_id` | **`RESTRICT` + 409 no service (escolhida)** | Auditoria preservada; coerente com ADR 0003 | Exige ajuste no `DELETE /v1/jobs/:id` e teste de demo |
| FK `job_id` | `CASCADE` | Exclusão simples | Apagaria candidaturas e seu histórico |
| FK `job_id` | `SET NULL` | Vaga sobrevive | `job_id` é obrigatório no modelo; perderia vínculo com a origem |
| Concorrência | **`pessimistic_write` na candidatura (escolhida)** | Fácil de verificar: uma vencedora, perdedora com `400` | Segura a linha durante a transação; volume pessoal, sem risco de escala |
| Concorrência | Versionamento otimista (`version` column) | Menos bloqueio | Coluna nova fora da spec e mais um campo no DTO |
| Dinheiro | **Reusar `money.ts` com `fieldName` (escolhida)** | Uma regra de `MAX_SAFE_INTEGER`; mensagens corretas | Todos os call sites precisam passar o nome do campo |
| Dinheiro | Helpers novos só para candidatura | Isolamento | Duplicaria limite e mensagens; divergiria da Sprint 3 |

## Spike opcional (20 minutos)

Só se houver dúvida sobre o texto do MySQL 8 ao fechar a tradução de erros:

1. Com o MySQL local e a migration de candidaturas já aplicados, disparar duas inserções
   concorrentes com o mesmo `(user_id, job_id)` (ou `INSERT` duplicado direto).
2. Tentar `DELETE` de vaga com candidatura vinculada.
3. Imprimir `driverError.sqlMessage` dos dois erros.

Critério de saída: confirmar o `isDuplicateEntry(error, 'UQ_applications_user_job')` já
adotado se o fragmento aparecer; se o driver omitir o nome, usar fragmento mais estreito
**apenas** no bloco de criação de candidatura, nunca globalmente. Para o `RESTRICT`, confirmar que
a checagem do `JobsService.remove` antecede o banco e devolve `409`; qualquer outro
`QueryFailedError` continua `500` sem vazar SQL, conforme o filtro global.

## Consequências

### Positivas

- Modelo alinhado à spec: mesma unidade monetária, mesma imutabilidade do histórico,
  mesmos helpers, mesmo `userId` do JWT e mesmas convenções de migrations do ADR 0003.
- Máquina de estados tem uma única fonte de verdade, verificável por teste unitário da
  matriz e pela demo da Fase 2.
- Transição atômica com bloqueio explícito: leitura concorrente vê o status antigo ou o
  novo, nunca o meio da escrita, e o histórico não pode ser alterado.
- Exceções de nomenclatura e de FK ficam documentadas, reduzindo retrabalho em Sprint 5
  (`resume_version`) e em manutenção futura (`RESTRICT`).

### Negativas / trade-offs

- `resumeVersionId` é um campo “sempre `null`” na resposta até a Sprint 5.
- Histórico não registra a criação (decisão provisória): a reconstrução começa em
  `SAVED -> ...`.
- `benefits` como `json` não tem validação no banco; integridade depende da aplicação.
- `RESTRICT` bloqueia a exclusão de vaga com candidatura; exige tratamento de `409` no
  service e passo explícito na demo.
- Duplicate index evitado: `UNIQUE (user_id, job_id)` atende ao índice pedido no plano,
  mas a checagem de `SHOW INDEX` entra no checklist.

### Riscos

- **R1 — Criação sem histórico:** decisão provisória; se o portão final exigir linha
  inicial, é mudança de regra + migration de backfill, não apenas de service.
- **R2 — `resume_version_id` sem FK:** se a Sprint 5 renomear a coluna ou criar a tabela
  com outra chave, será necessária migration de alinhamento.
- **R3 — `benefits` sem schema no banco:** outro gravador (script, seed) pode inserir
  objeto inválido; a API valida, o MySQL não.
- **R4 — Moeda sintática:** `/^[A-Z]{3}$/` aceita `XYZ`; igual ao risco R4 do ADR 0003.
- **R5 — Precisão de `bigint`:** acima de `Number.MAX_SAFE_INTEGER` o helper falha em vez
  de arredondar; contrato `number` no JSON precisa ser revisto se esse limite for atingido.
- **R6 — Fuso horário:** `from`/`to` são UTC; datas digitadas em fuso local podem
  deslocar um dia. Critério: usar `YYYY-MM-DD` sem offset, como a spec `:432`.
- **R7 — `note` sem trim:** espaços extras são preservados por decisão; pode gerar linhas
  visualmente diferentes com o mesmo texto.
- **R8 — Contenção do lock:** transições simultâneas na mesma candidatura serializam;
  aceitável para uso pessoal, mas merece monitoramento se virar produto multi-usuário.
- **R9 — Itens fora de escopo:** rota por vaga, `sort`, `DELETE` e `appliedFrom`/`appliedTo`
  continuam como pendências; não devem ser “implementados de passagem”.
- **R10 — Branch única:** Sprint 2, 3 e 4 uncommitted em `00b0647`; humano decide commit
  ou separação. Nenhum agente faz push, PR, merge ou deploy.

## Checklist de validação para o backend-dev

Itens implementados e validados estaticamente nesta execução (o architect não executou
comandos; resultados reportados pelo backend-dev na seção Validação local):

- [x] Escrever a migration versionada `1795046400000-CreateApplicationsDomain` com `applications` e `application_status_history` (singular), colunas/tipos/FKs/índice explicitados na Decisão 1, `unique(user_id, job_id)` e `synchronize: false`.
- [x] Validar a cadeia local: `migration:run` → `migration:revert` → `migration:run` → `migration:show` (4 aplicadas) e `schema:log` via CLI sem drift; nomes de FK explícitos e idênticos em entidade e migration.
- [x] Criar `ApplicationStatus`, exportar `APPLICATION_TRANSITIONS` e reaproveitar `SalaryPeriod`.
- [x] Criar entidades `Application` e `ApplicationStatusHistory` (sem `updated_at` na segunda) e todos os DTOs de request/response/query, com `resumeVersionId` apenas no response e `userId` apenas no response.
- [x] Rejeitar no body/query: `jobId`, `userId`, `user_id`, `status` (onde não aplicável), `appliedAt`, `closedAt`, `resumeVersionId`, `sort` e qualquer campo fora da whitelist, com a exceção documentada de `sort` em Contratos.
- [x] Implementar criação com ownership, `SAVED`, herança de `currency`/`salaryPeriod`, `409` por `unique` e `ER_DUP_ENTRY`, e nenhuma linha de histórico.
- [x] Implementar transição transacional com `pessimistic_write`, datas derivadas, mensagem `Invalid transition from ... Allowed statuses: ...` e histórico append-only.
- [x] Implementar compensação com `money.ts` + `fieldName`, `benefits` validado e opcionais descritivos; sem `PATCH /v1/applications/:id`.
- [x] Implementar filtros/paginação exatos, envelope `{ data, meta }`, `companyId` vazio, `from`/`to` em `created_at`, `totalPages: 0` e ordem fixa.
- [x] Ajustar `JobsService.remove` para `409` com candidatura vinculada, mantendo `204` quando não houver.
- [x] Documentar as seis rotas, DTOs, envelope e exemplos no Swagger `/docs`, incluindo `resumeVersionId: null`.
- [x] Rodar `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build` e `git diff --check` verdes.
- [x] Executar revisão read-only, corrigir `currency`/`salaryPeriod` no POST e remover a injeção morta de `jobsRepository`.

Responsável humano (não executado nesta execução):

- [ ] Testes unitários/e2e, demo manual e decisão de commit/push/PR/merge/deploy — humano, conforme `AGENTS.md`.

## Validação humana pendente (portão final)

As oito ambiguidades do `sprint-04.md:553-590` foram **decididas para implementação**,
não rejeitadas, e **não bloquearam a implementação**: KAN-30 a KAN-33 foram entregues com
essas propostas. Todas seguem sujeitas à confirmação final do humano na revisão, testes e
demo manual; uma mudança eventual vira ajuste registrado neste ADR, não retrabalho implícito.

| # | Ambiguidade | O que a proposta adotada significa na prática | Portão final |
|---|---|---|---|
| 1 | `resume_version_id` / Sprint 5 | Coluna nullable sem FK; `resumeVersionId: null` aparece em `201`, `200` e no envelope; POST/PATCH/query com o campo → `400`; associação real vira história da Sprint 5 | Confirmar se a resposta deve manter o campo `null` ou se ele sai do DTO; se sair, é quebra de contrato |
| 2 | `benefits` | Array de strings; `null`/omitido vira `null`; item não-string → `400`; PATCH substitui ou limpa | Confirmar se o produto aceita a forma provisória ou quer objeto estruturado (nova história + ADR) |
| 3 | `currency` / `salaryPeriod` | POST opcional com herança da vaga; `null` → `400`; PATCH altera explicitamente; regex e `SalaryPeriod` reaproveitados | Confirmar se deve ser obrigatório no POST ou imutável em relação à vaga |
| 4 | `from` / `to` | Filtro em `created_at` UTC com limites de dia; datas inválidas/`from > to` → `400`; `appliedFrom`/`appliedTo` não existem ainda | Confirmar se o humano prefere `applied_at` (o que excluiria `SAVED` dos intervalos) |
| 5 | `GET /v1/jobs/:id/application` | Rota não implementada; lista `GET /v1/applications` atende KAN-30..33; nenhum filtro `jobId` é aceito | Confirmar criação de história separada em E3 ou exclusão permanente do MVP |
| 6 | `sort=campo:asc\|desc` | `?sort=` → `400`; ordem fixa `createdAt DESC, id ASC`, igual à Sprint 3 | Confirmar se entra história de `sort` com whitelist por recurso |
| 7 | `note` do histórico | `varchar(500)` nullable, sem trim agressivo, nunca obrigatória nesta sprint; `> 500` → `400` | Confirmar se algum status (ex.: `REJECTED`) passa a exigir nota |
| 8 | `DELETE /v1/applications/:id` | Rota inexistente; nenhum `204` em `applications`; retirada/cancelamento por transição preserva histórico | Confirmar se exclusão física/lógica entra como história com política de retenção |

Também dependem de validação humana a exceção de nomenclatura (tabela singular), o
`RESTRICT` em `applications.job_id`, a decisão provisória sobre a criação sem linha de
histórico, o `userId` na resposta, a manutenção da branch única com Sprints 2/3/4
uncommitted e as suspeitas de execução listadas em Riscos no `sprint-04.md` (mensagem de
`sort` em runtime, concorrência do lock, fragmento de `ER_DUP_ENTRY`, `bigint` no JSON,
corrida entre `countBy`/`remove` e limites de `from`/`to`). Nada foi commitado, enviado
ao remoto, revisado em PR, mesclado ou deployado.

## Referências

- `docs/sprints/sprint-04.md:16-29` (histórias), `:31-95` (decisões e conflitos),
  `:128-151` (validação local), `:236-370` (contratos), `:371-429` (regras e modelo),
  `:502-552` (DoD e tarefas), `:553-590` (oito ambiguidades).
- `docs/adr/0003-sprint-3-pipeline.md:53-71` (resolução de conflitos), `:178-207`
  (`money.ts`), `:285-287` (rota por vaga), `:398-407` (exceções de FK), `:536-569`
  (checklist e portão humano).
- `docs/prompt-kandid.md:80-84` (convenções), `:138-145` (entidades), `:178-204`
  (máquina de estados), `:374-434` (API), `:508-514` (Fase 2).
- `docs/adr/0002-sprint-2-profile.md` (helpers, datas, `ER_DUP_ENTRY`).
- `src/common/utils/money.ts`, `src/common/utils/is-duplicate-entry.ts`,
  `src/common/utils/null-fields.ts`, `src/common/validators/is-date-only.validator.ts`.
- `AGENTS.md:50-79` e `kandid_api/AGENTS.md:41-60` (migrations, `/v1`, Swagger,
  ownership, segredos e qualidade).
