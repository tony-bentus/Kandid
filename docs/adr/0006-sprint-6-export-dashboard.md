# ADR 0006 — Export de currículo, entrevistas e dashboards da Sprint 6

- Status: Accepted
- Data: 2026-11-19
- Autores: architect (modelo de dados de entrevistas, contratos de export/dashboard, fórmulas executáveis, índices e registro); tech lead (decisões 1–6 da Sprint 6, fixadas em `docs/backlog.md:134-142`, e rulings R1–R13 de 2026-11-19); product-owner (histórias KAN-50..54, documento `docs/sprints/sprint-06.md`, publicado e reconciliado nesta revisão)
- Parecer: **aprovado com ajustes** — as seis decisões do tech lead e os rulings R1–R13 são formalizados sem reabertura; este ADR acrescenta (a) as fórmulas numéricas do dashboard com numerador, denominador, arredondamento e casos `null`, (b) o início do funil em `applied_at` com fallback para a transição `APPLIED`, (c) as taxas como número 0..100 (sem objetos `numerator`/`denominator`) e `interviewRate` por união entre tabela e histórico, (d) FK `CASCADE`, (e) índice de listagem `IX_interviews_application_round_scheduled`, (f) migration `CreateInterviewDomain` no singular e (g) `created_at`/`updated_at` como campos de infraestrutura. Os rulings R9–R13 (duração obrigatória, `<title>`/links/rodapé do HTML, resposta/oferta por status ou histórico, amostra do fallback e limite de `feedback`) foram adicionados na reconciliação final com o código. As interpretações de produto remanescentes seguem no portão humano.
- Branch e escopo: `feat/sprint-6-export-dashboard`, base `main` @ `667bf83`; Épico E5 (`docs/backlog.md:134-142`), KAN-50..54, Fase 4 da spec (`docs/prompt-kandid.md:526-534`). Sprints 0–5 concluídas; ADR 0005 aceito.
- Regime de validação: `Accepted` aqui significa “decidido para implementar”, **não** “implementado e validado”. Este ADR não executa comandos, não cria migration, não roda git/build/testes, não faz commit/push/PR/merge/deploy e não lê `.env`. As edições de reconciliação final foram feitas pelo tech lead neste ADR e em `docs/sprints/sprint-06.md`; o arquivista não tocou outros arquivos.
- Fora de escopo: seed (KAN-60/Sprint 7), PDF, DOCX, upload/importação de currículo, IA, e qualquer alteração em `applications`, `jobs`, `companies`, `profiles`, `resumes`, `resume_versions` ou `ats_analyses` — exceto a leitura dessas tabelas pelos novos endpoints.

## Contexto

A Sprint 6 fecha o produto funcional antes do hardening da Sprint 7. Ela tem três
blocos independentes que compartilham apenas as convenções de API:

1. **Export (KAN-50/51).** O snapshot imutável já existe desde a Sprint 5
   (`docs/prompt-kandid.md:306-361`, tabela `resume_versions.content_snapshot`) e o
   ADR 0005 adiou explicitamente `/export` para cá (decisão 1 do ADR 0005 `:286`).
   Export é, por definição, leitura pura: nenhuma escrita, nenhuma nova tabela.
2. **Entrevistas (KAN-52).** A spec define a entidade `interview` em `:144-145`, o
   enum em `:173-175` e a rota aninhada `CRUD /v1/applications/:id/interviews` em
   `:412`. É a primeira entidade mutável filha de `applications` desde o histórico
   append-only da Sprint 4.
3. **Dashboards (KAN-53/54).** A spec pede as duas rotas em `:420-421` e enumera os
   indicadores em `:529-530`, mas **não define fórmula, unidade, arredondamento nem
   tratamento de denominador zero**. Sem essa definição, duas implementações
   igualmente “corretas” produzem números diferentes para o mesmo banco — e o
   critério de pronto da Fase 4 (`:534`, “dashboard retorna dados coerentes”) fica
   inverificável. A Sprint 6 herda ainda uma coluna `resume_versions.ats_score` que
   o ADR 0005 decidiu manter **sempre `NULL`** (decisão 11, `:296`): o export não
   pode lê-la.

Restrições estruturais que atravessam a sprint:

- **Ownership sempre por join.** `interviews` não tem `user_id` (decisão 4 do tech
  lead) e o dashboard não recebe `userId` de query/body; o escopo vem do `sub` do
  JWT. Recurso alheio e recurso inexistente são indistinguíveis (`404`).
- **Dinheiro em centavos + `currency` + `salary_period`** (`AGENTS.md`). O dashboard
  de compensação é o primeiro consumidor agregado dessas colunas e é onde a regra
  “nunca agregar moedas distintas” deixa de ser style guide e vira requisito.
- **Determinismo onde houver teste.** O export HTML e os cálculos do dashboard são
  funções puras sobre dados já carregados, no mesmo espírito do motor ATS
  (`docs/prompt-kandid.md:205-207`), para que fixtures reproduzam o resultado. O
  dashboard é a exceção inevitável: lê o estado atual do banco, mas **não** usa
  relógio de parede — nenhum indicador depende de “agora”.
- **`synchronize: false`, migrations versionadas**, ESM com `.js`, TypeScript strict
  sem `any`, `/v1`, Swagger em `/docs`, `ValidationPipe` global, erros no formato
  único (`docs/prompt-kandid.md:425-436`).

Estado documental: `docs/sprints/sprint-06.md` foi publicado pelo product-owner e
reconciliado com este ADR na revisão final pelo tech lead. Onde o Sprint e este ADR
divergiam, prevaleceram os rulings R1–R13 do tech lead e a tabela de Resolução de
conflitos. Este ADR não edita o ADR 0005 nem o backlog, e nenhum comando é executado
a partir dele (regime da linha 8).

## Decisão

Adotar, para KAN-50..54:

1. **Uma rota de export** `GET /v1/resume-versions/:id/export?format=json|html`,
   com `format` obrigatório e sem default, ownership por join e zero escrita.
2. **JSON** = `{ resumeId, version, atsScore, contentSnapshot }`, com `atsScore`
   vindo da **análise mais recente** (`ats_analyses`), nunca de
   `resume_versions.ats_score`.
3. **HTML** gerado on demand por um módulo puro e determinístico, sem template
   engine, com escape obrigatório e sem recursos ativos.
4. **Uma tabela nova** `interviews` (`Interview` no singular), mutável, com
   `created_at`/`updated_at` como campos de infraestrutura, `UNIQUE (application_id,
   round)`, índice `IX_interviews_application_round_scheduled (application_id, round,
   scheduled_at, id)` para a listagem ordenada e FK `FK_interviews_application`
   (`CASCADE`).
5. **Dois endpoints de dashboard** escopados por usuário, com fórmulas fechadas
   em percentual 0..100 com 2 casas expostas como **número** (sem objetos
   `numerator`/`denominator`), `null` quando denominador é zero, `submitted` como
   denominador, `countsByStatus` com os 11 status sempre presentes e compensação
   agrupada por `(currency, salary_period)`.
6. **Início do funil = `applied_at`**, com fallback para a menor transição
   `APPLIED`; sem ambos, a candidatura é excluída da média de primeira resposta.
   `applications.created_at` fica apenas na âncora `SAVED` do dwell.
7. **Nenhuma migration de índice** além da tabela `interviews` e do seu índice de
   listagem.

## Modelo de dados

Migration sugerida: `1795824000000-CreateInterviewDomain` (classe
`CreateInterviewDomain1795824000000`), sequencial após
`1795737600000-CreateResumeDomain`. A cadeia local conferida nos arquivos de
migration é `1794182400000` → `1794268800000` → `1794960000000` → `1795046400000` →
`1795737600000`; o próximo valor soma o mesmo passo de 86.400.000 ms usado em toda a
série, sem colisão. **Não criar a migration nesta tarefa**; ela é especificada aqui
para o backend-dev. `synchronize: false` permanece.

Padrões aplicados: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;
`id varchar(36) NOT NULL PK` com `@PrimaryGeneratedColumn('uuid')`; datas em
`datetime(6)`; FKs com nomes idênticos em entidade e migration; tabela física no
plural (`interviews`) com entidade no singular (`Interview`) mapeada por
`@Entity('interviews')`, conforme decisão 4 do tech lead e o padrão do ADR 0005
`:29-35`. A exceção `application_status_history` (ADR 0004 `:127-153`) continua
isolada e não é tocada.

**`interviews`** (mutável — primeira tabela de entrevistas do domínio)

```text
id                 varchar(36) NOT NULL PK
application_id     varchar(36) NOT NULL
round              int NOT NULL
type               enum('HR','TECHNICAL','BEHAVIORAL','CASE','CULTURAL','FINAL') NOT NULL
scheduled_at       datetime(6) NOT NULL
duration_minutes   int NOT NULL
interviewer_name   varchar(120) NULL
interviewer_role   varchar(120) NULL
meeting_url        varchar(255) NULL
status             enum('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'SCHEDULED'
feedback           text NULL
outcome            enum('PENDING','PASSED','FAILED') NOT NULL DEFAULT 'PENDING'
created_at         datetime(6) NOT NULL
updated_at         datetime(6) NOT NULL

UNIQUE INDEX UQ_interviews_application_round (application_id, round)
INDEX IX_interviews_application_round_scheduled (application_id, round, scheduled_at, id)
FK interviews.application_id -> applications.id ON DELETE CASCADE ON UPDATE NO ACTION
```

- **Colunas exatas da spec `:144-145`**: `id`, `application_id`, `round`, `type`,
  `scheduled_at`, `duration_minutes`, `interviewer_name`, `interviewer_role`,
  `meeting_url`, `status`, `feedback`, `outcome`. `round` é `int` e `feedback` é
  `text`, como escrito. Enums vêm de `:173-175` sem alteração.
- **Campos de infraestrutura — `created_at`/`updated_at` (ruling R8).** A spec não
  lista timestamps em `interview`, mas `:79` estabelece a convenção para entidades
  mutáveis e toda tabela mutável do projeto os tem (`applications`, `jobs`,
  `resumes`). O tech lead confirmou que são campos padrão de infraestrutura, não
  campos de domínio e não desvio a ser submetido ao portão: não entram em DTOs de
  request e aparecem apenas como leitura em `InterviewResponseDto`. `updated_at` é
  usado somente por `PATCH`.
- **`application_id` sem `user_id`.** Ownership resolve por
  `interviews → applications.user_id`. Não há `user_id`, não há índice por usuário:
  a raiz do escopo é sempre a candidatura, que já tem `IX_applications_user_status`
  e `IX_applications_user_created`.
- **Ação da FK: `CASCADE`** (ruling R5 do tech lead, 2026-11-19). Entrevista é
  registro filho da candidatura, não auditoria; `application_status_history` já usa
  `CASCADE` (ADR 0004 `:127-153`). Apagar uma candidatura deve apagar suas
  entrevistas, não bloquear a operação. Consequência prática hoje: não existe rota
  `DELETE /v1/applications/:id` (`applications.controller.ts` expõe apenas POST,
  dois GET e dois PATCH), então a ação é preventiva e coerente com o padrão do
  domínio. Registrado como Risco R9.
- **`UNIQUE (application_id, round)`** (decisão 4 do tech lead). `round` identifica
  a rodada dentro da candidatura; duplicar a rodada torna a lista ambígua e a
  entrevista inexequível de referenciar. O service devolve `409` antes do banco e
  traduz `ER_DUP_ENTRY` de `UQ_interviews_application_round` para o mesmo `409`
  (padrão do ADR 0005 `:316`).
- **`round` não é posicional nem gerado pelo servidor.** É enviado pelo cliente e
  começa em 1 por candidatura (DTO valida `>= 1`). Reordenar rodadas é
  responsabilidade do cliente via `PATCH`; não há renumeração automática nesta
  sprint.
- **Nullabilidade (ruling R9).** `duration_minutes` é obrigatório (`int NOT NULL`,
  inteiro 1..1440) conforme a decisão 11 da sprint: a duração é conhecida no
  agendamento e o DTO a exige, evitando `NULL` no cálculo de agenda. Também são
  `NOT NULL`: `application_id`, `round`, `type`, `scheduled_at`, `status`
  (default `SCHEDULED`) e `outcome` (default `PENDING`). São nullable:
  `interviewer_name`, `interviewer_role`, `meeting_url` e `feedback` (este último
  limitado a 5000 caracteres no DTO, ruling R13). `PENDING` no enum `:175` só faz
  sentido como default de `outcome`; `SCHEDULED` é o único estado inicial coerente.
- **Sem máquina de estados.** A spec define `APPLICATION_TRANSITIONS` para
  candidaturas (`:180-194`) mas **nenhum** mapa para entrevistas. `status` e
  `outcome` são livres (qualquer valor do enum é aceito em `PATCH`), inclusive
  `COMPLETED` sem `feedback`. Inventar transições seria regra de negócio não
  especificada; fica no portão humano.
- **Sem `deleted_at`/soft delete.** `DELETE` é físico (`204`), como no CRUD de
  `companies`/`recruiters`.

**Índices e ordenação (ruling R6; critério verificável).**

- `UQ_interviews_application_round (application_id, round)` atende (a) a FK
  `FK_interviews_application`, que exige índice no prefixo `application_id`, e (b) o
  `409` de rodada duplicada.
- `IX_interviews_application_round_scheduled (application_id, round, scheduled_at,
  id)` atende a listagem `WHERE application_id = ? ORDER BY round ASC, scheduled_at
  ASC, id ASC`. A `UNIQUE` cobre somente o prefixo `(application_id, round)`: ela não
  ordena por `scheduled_at`/`id` e deixaria o `ORDER BY` para *filesort*. O índice de
  quatro colunas não é redundante com a `UNIQUE` porque estende o prefixo com as
  colunas de desempate — critério verificável por `EXPLAIN`, que não deve mostrar
  `Using filesort`.
- **Não criar** `IX_interviews_scheduled_at`, `IX_interviews_status` nem
  `IX_interviews_application_id`: nenhuma rota desta sprint filtra entrevistas por
  data ou status global, e a coluna isolada é prefixo dos dois índices existentes. O
  dashboard lê entrevistas por `EXISTS` a partir da candidatura do usuário (ver
  “Performance e índices”).
- **Nenhum índice novo em `applications` ou `application_status_history`.** As
  queries do dashboard usam `IX_applications_user_status (user_id, status)`,
  `IX_applications_user_created (user_id, created_at)` e
  `IX_application_status_history_app_changed (application_id, changed_at, id)`, todos
  já existentes (ADR 0004 `:111-116`, `:138`). A justificativa e o critério de
  verificação estão na seção “Performance e índices”.

Critério de aceite do schema: `SHOW INDEX FROM interviews` devolve **três índices**
— `PRIMARY` (1 coluna), `UQ_interviews_application_round` (2 colunas) e
`IX_interviews_application_round_scheduled` (4 colunas), totalizando sete linhas —
sem índice de coluna isolada e sem drift em
`npm run typeorm -- schema:log -d src/database/data-source.ts`;
`migration:run` → `revert` → `run` → `show` com 6 migrations aplicadas.

## Contratos

Prefixo `/v1`, Swagger em `/docs`, `Authorization: Bearer <jwt>` obrigatório
(sem header → `401`). `userId` sempre do `sub`; nenhum DTO declara `userId`,
`user_id`, `applicationId` (quando vem do path) ou `resumeVersionId`. UUID fora do
formato → `400`. Recurso alheio/inexistente → `404` com a mesma mensagem. Erros no
formato único `{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros principais |
|---|---|---|---|---|
| GET | `/v1/resume-versions/:id/export` | Query obrigatória: `format=json\|html` | `200` + `application/json` **ou** `text/html; charset=utf-8` | `400` (`format` ausente/inválido/duplicado), `401`, `404` |
| POST | `/v1/applications/:id/interviews` | `CreateInterviewDto` | `201` + `InterviewResponseDto` | `400`, `401`, `404`, `409` (`UQ_interviews_application_round`) |
| GET | `/v1/applications/:id/interviews` | — | `200` + `InterviewResponseDto[]` | `400`, `401`, `404` |
| GET | `/v1/applications/:id/interviews/:interviewId` | — | `200` + `InterviewResponseDto` | `400`, `401`, `404` |
| PATCH | `/v1/applications/:id/interviews/:interviewId` | `UpdateInterviewDto` | `200` + `InterviewResponseDto` | `400`, `401`, `404`, `409` |
| DELETE | `/v1/applications/:id/interviews/:interviewId` | — | `204` sem body | `400`, `401`, `404` |
| GET | `/v1/dashboard/summary` | — (nenhum parâmetro aceito) | `200` + `DashboardSummaryResponseDto` | `400` (query não suportada), `401` |
| GET | `/v1/dashboard/compensation` | — (nenhum parâmetro aceito) | `200` + `DashboardCompensationResponseDto` | `400`, `401` |

**Contagem.** São **oito** endpoints: um de export, cinco de entrevistas (CRUD
aninhado) e dois de dashboard. `GET /v1/applications/:id/interviews` e
`GET .../:interviewId` são leituras distintas; não há rota de listagem global de
entrevistas, nem `sort`, nem paginação.

### Export

- `format` é **obrigatório** e aceita exatamente `json` ou `html` (case-sensitive,
  sem `JSON`/`Html`). Ausente, vazio, repetido (`?format=json&format=html`) ou fora
  do conjunto → `400` com `format must be one of: json, html`. **Sem default** —
  decisão 1 do tech lead e spec `:372`.
- Query desconhecida (`?template=`, `&download=1`, `?Format=json`) → `400` no mesmo
  padrão do ADR 0004/0005 (`Unsupported query parameters: template. Supported:
  format`). `format` nunca aparece no body.
- Ownership: `SELECT` da versão com `INNER JOIN resumes ON resumes.id =
  resume_versions.resume_id` e `resumes.user_id = :sub`. Sem linha → `404 Resume
  version not found`, tanto para inexistente quanto para alheia.
- **Nenhuma escrita**: nenhuma transação, nenhum `INSERT`/`UPDATE`, nenhum arquivo
  gerado e persistido. O HTML é montado em memória a cada chamada.
- O export **não** consulta o perfil, a vaga ou o catálogo de skills: a única fonte
  é `content_snapshot`. Consequência desejada — exportar a versão 1 depois de editar
  o perfil continua devolvendo o conteúdo da versão 1.
- JSON (`Content-Type: application/json; charset=utf-8`):

```json
{
  "resumeId": "3f1c8a2e-7b64-4d0a-9a53-2f0b7c1d9e11",
  "version": 2,
  "atsScore": 78,
  "contentSnapshot": { "schemaVersion": "1.0", "targetRole": "...", "candidate": { "...": "..." } }
}
```

  - `atsScore` = `ats_analyses.score` da análise mais recente da versão
    (`ORDER BY created_at DESC, id ASC LIMIT 1`, usando
    `IX_ats_analyses_version_created`), independentemente do `job_id` da análise;
    `null` quando a versão nunca foi analisada. É a mesma fonte e a mesma ordenação
    de `GET /v1/resume-versions/:id/analysis` (ADR 0005 `:149`), que continua
    devolvendo `404` quando não há análise — o export devolve `200` com `null`.
  - `contentSnapshot` é copiado **byte a byte** do JSON persistido (desserializado e
    reserializado pelo driver), sem reordenação, sem enriquecimento e sem remoção de
    campos desconhecidos. `schemaVersion` viaja dentro do snapshot.
  - Envelope **aninhado**, não “espalhado”. Justificativa: achatar o snapshot no
    topo colidiria com os nomes de metadados se o contrato de snapshot evoluir
    (`resumeId`/`version` são genéricos) e impediria distinguir metadado de
    conteúdo. Interpretação do architect; spec `:366` apenas diz “snapshot +
    metadados”.
- HTML (`Content-Type: text/html; charset=utf-8`): ver seção Motor/Export. Sem
  `Content-Disposition`, sem `Cache-Control` especial nesta sprint.

### Entrevistas

**DTOs**

- `CreateInterviewDto`: `round` (int `>= 1`, obrigatório), `type` (enum
  `InterviewType`, obrigatório), `scheduledAt` (ISO 8601 UTC, obrigatório),
  `durationMinutes?` (int `1..1440`), `interviewerName?` (`1..120`),
  `interviewerRole?` (`1..120`), `meetingUrl?` (URL `http`/`https`, `<= 255`),
  `status?` (enum `InterviewStatus`, default `SCHEDULED`), `feedback?` (`<= 5000`
  caracteres), `outcome?` (enum `InterviewOutcome`, default `PENDING`). Rejeitar com
  `400`: `id`, `applicationId`, `userId`, `user_id`, `createdAt`, `updatedAt` e
  qualquer campo fora da whitelist.
- `UpdateInterviewDto`: subconjunto dos mesmos campos, com `hasField` para
  distinguir ausente de `null` (padrão do ADR 0005 `:142`). `null` em campo
  `NOT NULL` (`round`, `type`, `scheduledAt`, `status`, `outcome`) → `400`; `null`
  nos cinco campos nullable limpa o valor. Body vazio → `400`.
- `InterviewResponseDto`: `id`, `applicationId`, `round`, `type`, `scheduledAt`
  (ISO 8601 UTC), `durationMinutes`, `interviewerName`, `interviewerRole`,
  `meetingUrl`, `status`, `feedback`, `outcome`, `createdAt`, `updatedAt`. Nunca
  expõe `userId`.
- Não há `QueryInterviewDto`. A listagem devolve **array simples** ordenado por
  `round ASC, scheduled_at ASC, id ASC`, sem envelope `{ data, meta }`: a
  cardinalidade é limitada pelo número de rodadas de uma candidatura (unidades), o
  recurso é aninhado e a spec não pede paginação para ele. A convenção global de
  paginação (`:430`) é para coleções de primeiro nível; `GET /v1/companies` já é
  array simples (ADR 0003 `:239`). Decisão registrada no portão humano.

**Regras**

- `POST/GET` exigem candidatura do usuário: `404 Application not found` caso
  contrário.
- `GET/PATCH/DELETE .../:interviewId` exigem que a entrevista pertença à
  candidatura do path **e** que a candidatura pertença ao usuário. Entrevista de
  outra candidatura do mesmo usuário → `404` (o path é a fonte da verdade). Para
  isso o service carrega a entrevista com join em `applications.user_id`.
- `PATCH` que altera `round` para uma rodada já ocupada na mesma candidatura →
  `409 Interview round already exists for this application`. Pré-checagem no service
  + tradução de `ER_DUP_ENTRY` de `UQ_interviews_application_round`.
- `DELETE` físico, `204`. Não há bloqueio por status: entrevista `COMPLETED` pode
  ser removida (não há regra na spec; registro no portão).
- Nenhuma transação é obrigatória: cada operação toca **uma** tabela. O
  `POST` faz uma leitura de ownership e um `INSERT`; a corrida de `round` duplicado
  termina em `409`, nunca em `500`.
- `meeting_url` é validada por `new URL()` + protocolo `http|https`; `javascript:`,
  `data:`, `file:` e strings não parseáveis → `400`. Defesa em profundidade: o
  renderizador de HTML revalida o esquema antes de emitir `href` (Risco R6).

### Dashboard — `/v1/dashboard/summary`

Nenhum parâmetro aceito; `?from=&to=` ou qualquer outro → `400`. Sem filtro de
período nesta sprint (registrado como ideia futura). Resposta:

```json
{
  "totalApplications": 24,
  "submitted": 18,
  "countsByStatus": {
    "SAVED": 6, "APPLIED": 3, "SCREENING": 4, "SCHEDULED": 1, "INTERVIEW": 3,
    "OFFER": 2, "HIRED": 1, "REJECTED": 2, "WITHDRAWN": 1, "CANCELLED": 0, "GHOSTED": 1
  },
  "responseRate": 77.78,
  "interviewRate": 44.44,
  "offerRate": 22.22,
  "averageTimeToFirstResponseDays": 4.35,
  "averageDaysPerStage": [
    { "status": "SAVED", "averageDays": 2.5, "sampleSize": 18 },
    { "status": "APPLIED", "averageDays": 6.25, "sampleSize": 12 },
    { "status": "SCREENING", "averageDays": null, "sampleSize": 0 }
  ]
}
```

Exemplo abreviado: `averageDaysPerStage` traz os **11 status** na ordem do enum;
apenas três são mostrados acima.

- `countsByStatus` traz **sempre os 11 status** do enum `:172`, na ordem do enum,
  com `0` explícito. Contrato estável para gráfico: a chave existe antes de haver
  dado e não desaparece quando o valor é zero. Soma das chaves = `totalApplications`.
- `totalApplications` conta **todas** as candidaturas do usuário, inclusive `SAVED`.
- `submitted` é o universo de todos os denominadores: candidaturas com
  `applied_at IS NOT NULL` (ou seja, que já entraram em `APPLIED`, quando o campo é
  preenchido — `:200`). `SAVED` nunca foi enviada e não é conversão. É o **único**
  campo de contagem de base exposto ao lado das taxas (ruling R1).
- `responseRate`, `interviewRate` e `offerRate` são **números** em percentual
  0..100 com 2 casas decimais (half-up), não objetos e não razão 0..1: a unidade é a
  mesma de `score` no ATS, e não há `numerator`/`denominator` por taxa (ruling R1).
  São `null` quando `submitted = 0`. O numerador de cada taxa está definido na
  seção de fórmulas e é verificado por teste, não exposto na resposta. Amostras de
  tempo (`primeira resposta`, `sampleSize` por etapa) são metadados permitidos pelo
  ruling R4 apenas para `averageDaysPerStage`; `averageTimeToFirstResponseDays` não
  expõe tamanho de amostra.
- As três taxas são sempre `<= 100` por construção: o numerador é interseção com
  `submitted`.

### Dashboard — `/v1/dashboard/compensation`

Nenhum parâmetro aceito. Resposta:

```json
{
  "byCurrency": [
    {
      "currency": "BRL",
      "salaryPeriod": "MONTH",
      "applicationCount": 7,
      "proposed": { "count": 6, "minCents": 800000, "maxCents": 1500000, "averageCents": 1125000 },
      "offered": { "count": 3, "minCents": 900000, "maxCents": 1450000, "averageCents": 1183333 },
      "difference": { "absoluteCents": 133333, "percentage": 12.7, "pairedSampleSize": 3 }
    }
  ],
  "bySeniority": [
    {
      "currency": "BRL", "salaryPeriod": "MONTH", "seniority": "SENIOR", "applicationCount": 4,
      "proposed": { "count": 4, "minCents": 900000, "maxCents": 1500000, "averageCents": 1150000 },
      "offered": { "count": 2, "minCents": 1100000, "maxCents": 1450000, "averageCents": 1275000 },
      "difference": { "absoluteCents": 175000, "percentage": 17.5, "pairedSampleSize": 2 }
    }
  ],
  "bySkill": [
    {
      "currency": "BRL", "salaryPeriod": "MONTH", "skillId": "0b6f...", "skillName": "Node.js", "applicationCount": 5,
      "proposed": { "count": 4, "minCents": 800000, "maxCents": 1400000, "averageCents": 1075000 },
      "offered": { "count": 2, "minCents": 900000, "maxCents": 1450000, "averageCents": 1175000 },
      "difference": { "absoluteCents": 200000, "percentage": 20, "pairedSampleSize": 2 }
    }
  ]
}
```

- `byCurrency` é, na prática, **um item por par `(currency, salary_period)`** com
  ao menos um valor monetário. A moeda é requisito explícito; o período é o mesmo
  tipo de erro em outra dimensão — `min`/`max`/`avg` entre `MONTH` e `YEAR` diferem
  por 12× e produzem número sem significado. O par aparece como duas propriedades
  do mesmo item para preservar o nome `byCurrency[]` da decisão 5.
- `currency` vem de `applications.currency` (uma coluna para os dois valores, spec
  `:138`); não existe valor “em outra moeda” dentro da mesma linha, então agrupar
  por moeda é suficiente para nunca somar moedas distintas.
- `proposed` e `offered` são **estruturas sempre presentes**; com `count = 0`,
  `minCents`/`maxCents`/`averageCents` são `null`. `count` conta candidaturas com
  aquele campo não nulo no bucket.
- `minCents`/`maxCents` são inteiros em centavos; `averageCents` é a média
  aritmética arredondada half-up para o centavo inteiro (nunca fração de centavo).
- `difference` usa **amostra pareada** (candidaturas com **os dois** campos não
  nulos no bucket), não a diferença entre as duas médias populacionais — comparar
  populações de tamanhos diferentes produz uma diferença que não corresponde a
  nenhuma candidatura. `absoluteCents = round(mean(offered_pair) -
  mean(proposed_pair))`; `percentage = round(100 * (mean(offered_pair) -
  mean(proposed_pair)) / mean(proposed_pair), 2)`, `null` quando
  `pairedSampleSize = 0` ou `mean(proposed_pair) <= 0`. `percentage` negativo
  significa oferta abaixo do proposto. Por construção, `difference` **não**
  necessita ser igual a `offered.averageCents - proposed.averageCents`.
- `bySeniority` agrupa por `jobs.seniority` e inclui um bucket com
  `seniority: null` para vagas sem senioridade informada (`jobs.seniority` é
  nullable, `:66-72`), de modo que a soma de `applicationCount` reconcilia com
  `byCurrency`.
- `bySkill` deriva de `job_skill → skills` da vaga da candidatura. Uma candidatura
  com 5 skills aparece em 5 buckets: **a soma de `bySkill` não reconcilia com
  `byCurrency` por construção** e não deve ser usada como total. Ordenação fixa
  `currency ASC, salaryPeriod ASC, skillName ASC, skillId ASC`.
- **Exclusões explícitas:** (a) candidaturas com `proposed_salary_cents` **e**
  `offered_salary_cents` nulos não entram em nenhum bucket; (b) `jobs.salary_range_*`
  (faixa anunciada na vaga) **não** é usada — compensação é sobre o que foi proposto
  e ofertado à pessoa, não sobre o anúncio; (c) nenhuma conversão cambial e nenhuma
  normalização de período; (d) `salary_period` desconhecido não existe (enum
  `NOT NULL`).
- Status da candidatura **não** filtra o dashboard: `WITHDRAWN`, `REJECTED` e
  `CANCELLED` continuam contando se têm valor, porque a proposta/oferta registrada
  é dado histórico, não conversão.

## Motor/Export

### Renderizador HTML

Novo diretório `src/modules/resumes/export/`, sem dependência nova (nenhum
`handlebars`, `ejs`, `pug` ou similar) e sem import de Nest:

```text
escape-html.ts        escapeHtml(value: string): string
format-date.ts        formatYearMonth(value: string | null): string   // "2021-03" -> "03/2021"
render-resume-html.ts renderResumeHtml(input: ResumeHtmlInput): string
*.spec.ts             fixtures de snapshot, XSS e determinismo
```

Tipos descritivos (documentação, não código de produção):

```ts
interface ResumeHtmlInput {
  snapshot: ResumeSnapshot;   // tipo já existente em ats/engine/types.ts
  version: number;
}
```

**Regras do documento**

1. Documento completo: `<!DOCTYPE html>`, `<html lang="pt-BR">`, `<head>` com
   `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width,
   initial-scale=1">`, `<title>` e `<style>` inline; `<body>` com um único
   `<main>`. Sem dependência externa, sem `@import`, sem fonte remota.
2. **Estrutura semântica de coluna única:** `<header>` (nome em `<h1>`, headline,
   contato) e uma `<section>` por bloco com `<h2>` e `<ul>/<li>` ou `<p>`.
3. **Proibido:** `<table>`, `<img>`, `<svg>`, `<iframe>`, `<script>`, `<form>`,
   `<style>` externo, atributo de evento (`on*`) e qualquer CSS que produza
   múltiplas colunas (`grid-template-columns`, `float`, `display: table`). O CSS é
   um bloco fixo dentro de `<style>`; nada do snapshot entra em CSS.
4. **Títulos fixos da spec `:371`**, nesta ordem, renderizados somente quando o
   bloco tem conteúdo: `Resumo` (`summary`), `Habilidades` (`skills`),
   `Experiência Profissional` (`experiences`), `Formação` (`education`),
   `Certificações` (`certifications`), `Idiomas` (`languages`). Bloco vazio é
   omitido — não se emite `<h2>` sem conteúdo.
5. **`projects` não é renderizado nesta sprint.** A spec `:371` fixa seis títulos e
   `projects` está fora deles; no contrato do snapshot ele é sempre `[]`
   (ADR 0005 `:408`). Nenhum dado real é perdido hoje. Registrado no portão.
6. **`<title>` derivado de `targetRole`/nome (ruling R10):** `{name} — Currículo`;
   nome vazio → `{targetRole} — Currículo`; ambos vazios → `Currículo`. O título é
   escapado como qualquer outro texto.
7. **Escape obrigatório de todo texto do usuário**, sem exceção: nome, headline,
   contato, resumo, skills, cargos, empresas, bullets, instituições, certificações,
   idiomas, nomes de links e valores de atributo. `escapeHtml` cobre no mínimo
   `&`, `<`, `>`, `"`, `'` (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) e é aplicado
   no momento da emissão, não no dado (o snapshot nunca é mutado).
8. **Links com allowlist de esquema (ruling R10).** `href` só é emitido para
   `http` e `https`; e-mail, telefone e demais valores são texto puro, sem
   `mailto:`. URL inválida ou com esquema proibido é renderizada como texto
   escapado, sem `href`. Isso impede `javascript:` mesmo que o snapshot tenha
   sido gravado antes da validação de DTO.
9. **Datas determinísticas.** `YYYY-MM` → `MM/AAAA` por `formatYearMonth`; sem
   `Date.toLocaleDateString`, sem `Intl` (ICU varia por ambiente) e sem
   `Date.now()`. Experiência `current: true` renderiza `03/2021 — atual`.
10. **Sem rodapé, sem `version` e sem `generatedAt` (ruling R10).** O documento
    termina após a última seção renderizada; `version` e `generatedAt` pertencem ao
    envelope JSON, não ao HTML. Isso preserva o determinismo byte-a-byte e evita
    metadados não pedidos pela spec.
11. **Função pura:** mesma entrada → string idêntica, sempre. Proibido `Date.now()`,
    `Math.random()`, leitura de ambiente, I/O e estado de módulo mutável. Teste:
    duas chamadas com a mesma fixture produzem strings iguais; a fixture com
    `<script>alert(1)</script>` no nome não produz `<script` na saída.

**Pipeline do endpoint**

1. Validar `format` (DTO de query) → `400`.
2. Carregar a versão com join de ownership → `404`.
3. `format=json`: buscar a última análise (uma query, `null` se não houver) e
   serializar `{ resumeId, version, atsScore, contentSnapshot }`.
4. `format=html`: buscar a última análise **somente** para nada — o HTML não exibe
   score; a busca é desnecessária e **não** é feita. Chama `renderResumeHtml` e
   devolve a string com `Content-Type: text/html; charset=utf-8`.
5. Nenhuma transação, nenhuma escrita, nenhuma persistência do HTML.

### Calculadoras do dashboard

`src/modules/dashboard/` com controller, service, DTOs e um diretório de funções
puras `metrics/` (mesmo padrão do motor ATS, `:207`):

```text
metrics/rates.ts          rate(numerator, denominator): number | null
metrics/dwell.ts          buildDwellSegments(application, historyRows): DwellSegment[]
metrics/compensation.ts   aggregateStats(values: readonly number[]): StatsDto
                          pairedDifference(proposed, offered): DifferenceDto
```

- Arredondamento half-up com inteiros: `round2(x) = Math.round((x + Number.EPSILON) * 100) / 100`.
  Para percentual, calcular a razão em ponto flutuante apenas no fim
  (`numerator * 100 / denominator`), nunca acumular percentuais arredondados.
  `numerator`/`denominator` são parâmetros internos; `rate` devolve o número (ou
  `null`), nunca um objeto de contrato (ruling R1).
- Centavos: agregações de `min`/`max`/`count` feitas em SQL; médias calculadas a
  partir de `SUM`/`COUNT` e arredondadas uma única vez para centavo inteiro. O
  driver devolve `bigint`/`decimal` como string; a conversão usa o helper de centavos
  já existente (`bigintCentsToNumber`), que lança em vez de truncar, preservando o
  padrão do `applications.service.ts:412-424`. Nenhuma soma de centavos em `float`
  intermediário: `SUM` em SQL devolve decimal exato.
- Nenhuma função recebe `Date.now()`; todas recebem os dados já carregados.

## Fórmulas executáveis do dashboard

Convenções gerais: `U` = candidaturas do usuário (`applications.user_id = sub`);
`S` = `{ a ∈ U | a.applied_at IS NOT NULL }` (enviadas). Percentual = 0..100 com 2
casas, half-up. `null` sempre que o denominador for 0. Todas as datas vindas do
banco são `datetime(6)` em UTC; nenhum indicador depende de fuso local.

### `GET /v1/dashboard/summary`

**1. Contagens**

```text
totalApplications = count(a ∈ U)
countsByStatus[s] = count(a ∈ U | a.status = s)   para os 11 valores de ApplicationStatus
submitted = count(a ∈ S)
```

**2. `responseRate`**

```text
RESPONSE = { SCREENING, SCHEDULED, INTERVIEW, OFFER, HIRED, REJECTED }

responded(a) = a.status ∈ RESPONSE OR ∃ h ∈ history(a) | h.to_status ∈ RESPONSE
numerator   = count(a ∈ S | responded(a))
denominator = submitted = count(a ∈ S)
responseRate = denominator = 0 ? null : round2(100 * numerator / denominator)
```

`numerator` e `denominator` são variáveis internas do cálculo, verificadas por teste;
a resposta expõe apenas `responseRate` e `submitted` (ruling R1).

- “Resposta” é **sinal da empresa após o envio**, lido do status atual **ou** do
  histórico append-only (`application_status_history`, ruling R11): quem chegou a
  `OFFER` e hoje está `WITHDRAWN` já teve resposta e continua contando, e dados
  importados sem histórico não são penalizados.
- **`GHOSTED` não é resposta.** O próprio status significa “a empresa não respondeu”;
  incluí-lo tornaria a taxa uma medida de “algo aconteceu”, não de retorno.
- **`WITHDRAWN`/`CANCELLED` não são resposta**: são ações do candidato.
  `APPLIED` não é resposta (é o próprio envio). `HIRED`/`REJECTED` são respostas.
- `SAVED` nem entra no denominador: nunca houve contato com a empresa.

**3. `interviewRate`**

```text
HAPPENED = { SCHEDULED, COMPLETED }
INTERVIEW_REACHED = { INTERVIEW, OFFER, HIRED }

hasInterview(a)     = ∃ i ∈ interviews | i.application_id = a.id AND i.status ∈ HAPPENED
reachedInterview(a) = a.status ∈ INTERVIEW_REACHED
                      OR ∃ h ∈ history(a) | h.to_status ∈ INTERVIEW_REACHED
interviewed(a)      = hasInterview(a) OR reachedInterview(a)
numerator   = count(a ∈ S | interviewed(a))
denominator = submitted = count(a ∈ S)
interviewRate = denominator = 0 ? null : round2(100 * numerator / denominator)
```

- **União, não interseção** (ruling R2): conta tanto a entrevista registrada na
  tabela `interviews` (KAN-52) quanto a chegada a `INTERVIEW`/`OFFER`/`HIRED` pelo
  **status atual ou histórico**. Objetivo: não penalizar quem não registrou a
  entrevista no sistema.
- Status/histórico cobre os casos em que a etapa foi pulada ou revertida (o mapa
  `:189` permite `GHOSTED → INTERVIEW`) e os dados importados sem registros de
  entrevista. `HIRED` entra na união por robustez, como em `offerRate`.
- Na tabela, `CANCELLED` e `NO_SHOW` não contam: não houve entrevista. Entrevista
  futura `SCHEDULED` conta como conversão — é a convenção de funil e não há coluna
  de “realizada” além de `status`.
- Interseção com `S` garante `interviewRate <= 100` mesmo se houver entrevista ou
  status avançado em candidatura `SAVED` (dado inconsistente, mas possível via API).

**4. `offerRate`**

```text
OFFER_REACHED = { OFFER, HIRED }

offered(a)  = a.status ∈ OFFER_REACHED OR ∃ h ∈ history(a) | h.to_status ∈ OFFER_REACHED
numerator   = count(a ∈ S | offered(a))
denominator = submitted = count(a ∈ S)
offerRate   = denominator = 0 ? null : round2(100 * numerator / denominator)
```

- Status atual ou histórico (ruling R11), pelo mesmo motivo da taxa de resposta:
  `OFFER → REJECTED` não apaga o fato de ter havido oferta, e dados sem histórico
  não são penalizados.
- `HIRED` está incluído por redundância: a máquina de estados (`:188`) exige
  `OFFER → HIRED`, mas incluir torna a fórmula robusta a dados de seed/importados.

**5. `averageTimeToFirstResponseDays`**

```text
start(a)   = a.applied_at às 00:00:00 UTC, quando a.applied_at IS NOT NULL
             (fallback: min{ h.changed_at | h ∈ history(a), h.to_status = APPLIED })
end(a)     = min{ h.changed_at | h ∈ history(a), h.to_status ∈ RESPONSE }
delta(a)   = end(a) - start(a)
sample     = { a ∈ U | start(a) existe E end(a) existe E delta(a) >= 0 }
averageTimeToFirstResponseDays =
             |sample| = 0 ? null : round2( mean( delta(a) / 86_400_000 ms ) )
```

- **Ordem do marco inicial (ruling R3):** `applied_at` tem precedência quando
  presente; o fallback é a menor `changed_at` de transição para `APPLIED`; sem
  nenhum dos dois, a candidatura é **excluída** da amostra. Por ruling R12, a amostra
   deste indicador é `U` (não `S`): uma candidatura sem `applied_at` mas com transição
   `→ APPLIED` é considerada submetida apenas para este cálculo, enquanto o
   denominador das taxas continua sendo `S`.
- `applied_at` é `date` (sem hora, `:138`), por isso é interpretado às 00:00:00 UTC;
  a transição `SAVED → APPLIED` grava `changed_at` com precisão de microssegundo
  (`applications.service.ts:206-229`) e é usada apenas no fallback.
- `end(a)` é a menor `changed_at` com `to_status` no conjunto `RESPONSE`, sem filtro
  prévio por `start`; deltas negativos (dado corrompido) são excluídos da média.
- A média é em dias, com 2 casas half-up, e `null` quando a amostra está vazia. Não
  há campo de tamanho de amostra neste indicador (ruling R1): o metadado exposto é
  apenas `sampleSize` por etapa em `averageDaysPerStage` (ruling R4).
- A subtração é feita em milissegundos inteiros (microssegundos / 1000) antes da
  média; a divisão por 86.400.000 ocorre no fim, arredondada uma vez.

**6. `averageDaysPerStage`**

```text
Para cada a ∈ U:
  seq(a) = [(SAVED, a.created_at)] ++ sort(history(a), changed_at ASC, id ASC)
  para i de 0..|seq|-2:
    status  = seq[i].to_status            // status vigente; SAVED na âncora sintética
    days    = (seq[i+1].changed_at - seq[i].changed_at) / 86_400_000
    segmento = (status, max(days, 0))

averageDaysPerStage[s] = |segments(s)| = 0 ? null : round2(mean(segments(s).days))
sampleSize[s]          = |segments(s)|
```

- **“Etapa” é o status em que a candidatura permaneceu**, não o status de destino.
  O segmento começa na entrada e termina na transição seguinte; é isso que mede
  tempo por etapa.
- **A âncora sintética `(SAVED, created_at)`** cobre o período entre criar a
  candidatura e a primeira transição. Sem ela, `SAVED` nunca teria tempo — a
  criação não grava linha de histórico (ADR 0004, `applications.service.ts:137-173`
  só insere em `transition`), e a etapa mais longa do funil ficaria invisível.
  Se o histórico já começar com uma linha `to_status = SAVED` (dado importado), a
  âncora produz um segmento de ~0 dia, inofensivo e determinístico.
- **O último segmento é aberto e não entra na média.** Medir “até agora” exigiria
  relógio de parede e faria o número mudar sozinho sem nenhuma escrita — impede
  teste de fixture e torna o indicador irreprodutível. O custo é que status
  terminais (`HIRED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`) nunca aparecem: não há
  transição depois deles. As etapas terminais ficam com `null`/`0` amostras, o que
  é honesto: o tempo em etapa terminal não é uma métrica de funil.
- Ordenação por `(changed_at, id)` — o `id` desempata transições gravadas no mesmo
  microssegundo, dando ordem total e estável.
- `days` negativo (dado corrompido) é clampado em `0` para não contaminar a média.
- Retorno: **array com os 11 status na ordem do enum**, cada um com `averageDays`
  (`null` se não houver segmento fechado) e `sampleSize`. `sum(sampleSize)` é o
  número de segmentos fechados, **não** de candidaturas.

### `GET /v1/dashboard/compensation`

```text
bucket(a) = (a.currency, a.salary_period)

proposedValues(b) = { a.proposed_salary_cents | a ∈ U, bucket(a) = b, proposto não nulo }
offeredValues(b)  = { a.offered_salary_cents  | a ∈ U, bucket(b), ofertado não nulo }
pairs(b)          = { a ∈ U | bucket(a) = b, proposto e ofertado não nulos }

stats(V) = |V| = 0
  ? { count: 0, minCents: null, maxCents: null, averageCents: null }
  : { count: |V|, minCents: min(V), maxCents: max(V),
      averageCents: round(sum(V) / |V|) }

difference(b):
  pairedSampleSize = |pairs(b)|
  absoluteCents    = pairedSampleSize = 0 ? null
                     : round(mean(offered(pairs)) - mean(proposed(pairs)))
  percentage       = pairedSampleSize = 0 OR mean(proposed(pairs)) <= 0 ? null
                     : round2(100 * (meanOffered - meanProposed) / meanProposed)

byCurrency[b]      = { currency, salaryPeriod, applicationCount: |apps(b) com valor|,
                       proposed: stats(proposedValues(b)), offered: stats(offeredValues(b)),
                       difference }
bySeniority[b, s]  = mesma estrutura + seniority: jobs.seniority (null = "não informada")
bySkill[b, k]      = mesma estrutura + skillId/skillName de job_skill
```

- `applicationCount` por bucket = candidaturas com **pelo menos um** dos dois
  valores; difere de `proposed.count` e `offered.count` quando os campos são
  preenchidos de forma desigual.
- `round(x)` = centavo inteiro half-up; `round2` = percentual com 2 casas.
- **Nenhuma agregação cruza `b`.** Duas moedas → dois itens; dois períodos → dois
  itens. Nenhum total global é retornado (não existe “média geral de salário”).
- `difference` é sempre por par `(currency, salary_period)` e por amostra pareada
  (justificativa no Contrato de compensação).
- `bySeniority` inclui o bucket `seniority: null`; `bySkill` expande por skill e
  **não** reconcilia com `byCurrency` (uma candidatura tem N skills).

## Performance e índices

**Resumo (4 consultas, todas escopadas por `user_id`)**

| # | Consulta | Índice esperado |
|---|---|---|
| 1 | `SELECT status, COUNT(*) FROM applications WHERE user_id = ? GROUP BY status` | `IX_applications_user_status` (cobre filtro e agrupamento) |
| 2 | `SELECT COUNT(*) FROM applications WHERE user_id = ? AND applied_at IS NOT NULL` | `IX_applications_user_created` (prefixo `user_id`) |
| 3 | `EXISTS` de resposta/oferta por candidatura: `history` com `to_status IN (...)` | `IX_application_status_history_app_changed` por `application_id` |
| 4 | `EXISTS` de entrevista: `interviews` com `status IN ('SCHEDULED','COMPLETED')` | `UQ_interviews_application_round` (prefixo `application_id`) |

As consultas 3 e 4 podem virar dois `LEFT JOIN ... GROUP BY` ou um `SELECT` de
flags; em qualquer forma o acesso é nested-loop pela candidatura, sem varredura de
`application_status_history` inteira. A leitura de segmentos (dwell) carrega
`(application_id, created_at, to_status, changed_at, id)` das candidaturas do
usuário, ordenada por `application_id, changed_at, id`, e calcula em memória — o
volume por usuário é de centenas de linhas, e a função pura é testável por fixture.
Essa é uma escolha explícita por testabilidade sobre pushdown de SQL: window
functions resolveriam em uma query, mas escondem a regra (âncora, clamp, segmento
aberto) no dialeto e não seriam cobertas por unit test.

**Compensação (uma consulta por agrupamento, ou uma com `ROLLUP` parcial)**

`FROM applications a JOIN jobs j ON j.id = a.job_id` (e `LEFT JOIN job_skill js` /
`JOIN skills s` para `bySkill`), `WHERE a.user_id = ?`, `GROUP BY a.currency,
a.salary_period`, com `COUNT(CASE WHEN ... )`, `MIN`, `MAX`, `SUM` condicionais.
Índices: `IX_applications_user_status`/`user_created` para o filtro; PK de `jobs`;
PK composta `(job_id, skill_id)` de `job_skill` (ADR 0003); PK de `skills`.
Nenhum índice novo é necessário.

**Export**: versão por PK + join em `resumes` (PK), última análise por
`IX_ats_analyses_version_created` com `ORDER BY created_at DESC, id ASC LIMIT 1`.

**Conclusão de índices**: a única migration de schema da sprint é
`1795824000000-CreateInterviewDomain`. **Nenhuma migration adicional de índice** é
necessária em `applications`, `application_status_history`, `jobs`, `job_skill`,
`skills`, `resumes`, `resume_versions` ou `ats_analyses`.

Critérios verificáveis:

- `EXPLAIN` das consultas 1–4 não mostra `type: ALL` em `applications` nem em
  `application_status_history`.
- `SHOW INDEX FROM interviews` = PK + `UQ_interviews_application_round`, nada mais.
- `schema:log` sem drift (índice criado à mão que a entidade não declara apareceria
  como drift).

## Alternativas consideradas

| Tema | Alternativa | Prós | Contras / por que não |
|---|---|---|---|
| Rota de export | **`GET .../export?format=` com `format` obrigatório (escolhida)** | Fiel a `:365-372`; um recurso, dois formatos; `400` explícito | Cliente precisa lembrar o parâmetro; sem default “amigável” |
| Rota de export | `GET .../export.json` e `/export.html` | `format` impossível de esquecer | Duas rotas não previstas na spec; contraria `:372` |
| Rota de export | Default `json` quando ausente | Conveniência | `:372` proíbe default de forma explícita |
| `atsScore` | **Última `ats_analyses.score` (escolhida)** | Preserva decisão 11 do ADR 0005 (`resume_versions.ats_score` fica `NULL`); mesma fonte de `GET .../analysis` | Uma query extra; score é o “mais recente”, não o da versão |
| `atsScore` | Ler `resume_versions.ats_score` | Zero query extra | Coluna é sempre `NULL`; devolveria `null` mesmo com análise |
| `atsScore` | Atualizar `resume_versions.ats_score` no export | “Corrigiria” a coluna | Efeito colateral de escrita em rota de leitura e quebra de imutabilidade |
| Envelope JSON | **`contentSnapshot` aninhado (escolhida)** | Metadados e conteúdo não colidem; evolução do snapshot não quebra o topo | Um nível a mais para o cliente |
| Envelope JSON | Snapshot espalhado no topo + metadados | Cliente lê `candidate` direto | Colisão de nomes e ambiguidade `version` (da versão vs. `schemaVersion`) |
| HTML | **Módulo puro + template string (escolhida)** | Zero dependência nova; determinístico; testável por string | Sem conveniências de template engine (partials, autoescape); o escape é responsabilidade explícita de uma função testada |
| HTML | Adicionar `handlebars`/`ejs` | Autoescape e ergonomia | Dependência nova não justificada por um documento estático; superfície de configuração e versão |
| HTML | Gerar e persistir o HTML | Cache/velocidade | Viola “on demand” (`:368`); cria estado derivado e invalidação |
| HTML | Incluir `projects` | Não perder dados | Título não está em `:371`; `projects` é sempre `[]` nesta fase |
| Tabela | **`interviews` plural + `Interview` (escolhida)** | Padrão físico do projeto (`applications`, `resumes`); nome de FK `FK_interviews_application` já pressupõe plural | Desvio textual da spec `:144` (singular), registrado |
| Tabela | `interview` singular | Fidelidade literal | Única exceção do projeto é `application_status_history`; criaria segunda exceção sem motivo funcional |
| Timestamps | **`created_at`/`updated_at` em `interviews` (escolhida, ruling R8)** | Campos de infraestrutura padrão; auditoria e ordenação estável | Duas colunas a mais que a spec, mas confirmadas pelo tech lead |
| Timestamps | Só `created_at` | Menos colunas | Perde a data da última alteração em recurso mutável; o projeto não faz isso |
| Timestamps | Nenhum timestamp | Fidelidade à lista de `:144-145` | Entrevistas sem ordem de criação; `updated_at` impossível de auditar |
| `round` | **`UNIQUE (application_id, round)` (escolhida)** | Rodada é identificador natural; evita lista ambígua; índice serve a FK | `409` em dados importados com rodadas duplicadas; exige `PATCH` cuidadoso |
| `round` | Sem unique, ordem por `scheduled_at` | Aceita qualquer dado | Duas “rodada 2” na mesma candidatura; impossível referenciar sem ambiguidade |
| `round` | Gerado pelo servidor (`MAX+1`) | Nunca duplica | Esconde o número do cliente e conflita com reordenação manual; a spec expõe `round int` |
| Índice de entrevistas | **`UNIQUE` + `IX_interviews_application_round_scheduled` (escolhida, ruling R6)** | A `UNIQUE` protege a rodada e a FK; o índice de 4 colunas elimina *filesort* na listagem | Dois índices na mesma migration; nenhum deles é duplicata de coluna isolada |
| Índice de entrevistas | Só a `UNIQUE` | Um índice a menos | Cobre apenas `(application_id, round)` e deixa `scheduled_at, id` para *filesort* |
| Listagem de entrevistas | **Array simples ordenado (escolhida)** | Recurso aninhado e cardinalidade mínima; sem envelope inventado | Foge da convenção global `{ data, meta }` de `:430` |
| Listagem de entrevistas | Envelope paginado | Uniformidade | Paginação de 0–10 itens por candidatura é cerimônia sem uso |
| Início do funil | **`applied_at` com fallback para transição `APPLIED` (escolhida, ruling R3)** | Mede envio, não bookmark; exclui `SAVED`; usa o marco mais preciso disponível | Linhas sem nenhum dos dois marcos saem da amostra (seed futuro) |
| Início do funil | `created_at` | Sempre presente | Inclui `SAVED` no denominador e infla o funil com currículos nunca enviados |
| `interviewRate` | **União tabela + status/histórico (escolhida, ruling R2)** | Não penaliza ausência de registro de entrevista; cobre etapas puladas/revertidas | Numerador pode vir de dados sem evento de entrevista |
| `interviewRate` | Só `interviews.status ∈ {SCHEDULED, COMPLETED}` | Fonte única e simples | Perde quem chegou a `INTERVIEW`/`OFFER`/`HIRED` sem registrar entrevista |
| Unidade das taxas | **Percentual 0..100, 2 casas (escolhida, ruling R1)** | Unidade de `score`; sem multiplicação no cliente; `numerator`/`denominator` internos verificados por teste | Cliente que espera razão 0..1 divide por 100 |
| Unidade das taxas | Razão 0..1 | Neutro | Toda tela converte; leitura menos imediata |
| “Resposta” | **Histórico com `GHOSTED` excluído (escolhida)** | Respeita o significado de “sem resposta” | Exige subquery no histórico |
| “Resposta” | Status atual diferente de `APPLIED` | Query trivial | Perde quem já saiu do status (ex.: `OFFER → WITHDRAWN`) |
| Tempo por etapa | **Segmentos fechados + âncora `SAVED` (escolhida)** | Determinístico; inclui a etapa mais longa | Ignora o tempo na etapa atual; terminais ficam sem amostra |
| Tempo por etapa | Incluir segmento atual até `now` | “Mais completo” | Não determinístico; resultado muda sem escrita; irreprodutível em teste |
| Compensação | **Bucket `(currency, salary_period)` (escolhida)** | Impede somar BRL/USD e mensal/anual | Mais itens na resposta; cliente escolhe o período |
| Compensação | Bucket só por `currency` | Resposta menor | `AVG` entre MONTH e YEAR é 12× errado |
| Compensação | Normalizar tudo para mensal | Um número por moeda | Conversão de período é regra de negócio não especificada; HOUR→MONTH é indefinido |
| Diferença | **Amostra pareada (escolhida)** | Diferença corresponde a candidaturas reais | `difference` não é a subtração das médias exibidas |
| Diferença | `offered.avg - proposed.avg` | Simples | Compara populações diferentes; número sem interpretação |
| `bySkill` | **Expandir por skill da vaga (escolhida)** | Responde “quanto pagam vagas que pedem X” | Soma não reconcilia; skills correlacionadas aparecem juntas |
| `bySkill` | Só skills do perfil do usuário | Menor cardinalidade | Responde outra pergunta (perfil, não mercado) |

## Consequências

### Positivas

- Export é 100% leitura: nenhuma escrita, nenhuma tabela, nenhuma invalidação de
  cache. O snapshot da Sprint 5 vira valor de produto sem tocar no schema.
- `atsScore` do export e de `GET .../analysis` vêm da mesma fonte e da mesma
  ordenação; não há dois números de score no sistema.
- HTML sem dependência nova mantém a superfície de supply chain igual à da Sprint 5
  e o renderizador é testável por comparação de string.
- Entrevistas entram com uma única tabela: a `UNIQUE (application_id, round)` cobre
  FK e `409`, e `IX_interviews_application_round_scheduled` cobre a ordenação da
  listagem sem *filesort* (ruling R6), sem índice de coluna isolada.
- As fórmulas do dashboard são fechadas: numerador e denominador são **variáveis
  internas do cálculo**, e unidade, arredondamento e `null` estão definidos. O JSON
  expõe apenas `responseRate`, `interviewRate`, `offerRate` e `submitted` entre as
  taxas; `sampleSize` por etapa e `pairedSampleSize` na compensação são metadados
  agregados permitidos. Duas implementações que sigam o ADR produzem o mesmo JSON.
- O dashboard não depende de relógio de parede; fixtures reproduzem cada indicador.
- Nenhuma alteração em tabelas existentes; a cadeia de migrations continua
  sequencial e `synchronize: false` permanece.

### Negativas / trade-offs

- `resume_versions.ats_score` continua sempre `NULL` (decisão 11 do ADR 0005
  preservada): quem ler a tabela direto não encontra score, e o export faz uma query
  extra.
- O export JSON aninha o snapshot em `contentSnapshot`; não é o snapshot “no topo”.
- O HTML omite `projects`, `version`, `generatedAt` e qualquer rodapé (ruling R10) —
  omissões registradas; o envelope JSON mantém os metadados.
- `interviews` ganha `created_at`/`updated_at` que a spec não lista, confirmados
  como campos de infraestrutura pelo ruling R8.
- `UNIQUE (application_id, round)` recusa dados legados/importados com rodada
  repetida; a Sprint 7 precisa gerar rodadas válidas no seed.
- O tempo por etapa ignora o segmento atual; status terminais nunca têm média.
- Taxas percentuais com 2 casas perdem precisão para amostras muito pequenas (1 de
  3 = 33.33%); por decisão R1 os inteiros brutos não são expostos — apenas
  `submitted` como denominador, com numerador verificável em teste.
- `bySkill` não reconcilia com `byCurrency`, por construção.
- O bucket `(currency, salary_period)` aumenta o número de itens e transfere ao
  cliente a escolha do período.

### Riscos

- **Risco R1 — `atsScore` do export.** Se o portão humano decidir que o export deve ler
  `resume_versions.ats_score`, a coluna terá de ser preenchida em algum momento, o
  que reabre a imutabilidade do ADR 0005 (risco R1 daquele ADR). Não é ajuste local.
- **Risco R2 — `applied_at` como marco.** Candidaturas criadas antes de existir transição
  `SAVED → APPLIED` (dados de seed/importação) ficam fora de `S` e de todas as
  taxas. O fallback cobre o *tempo até a resposta*, mas não o denominador: sem
  `applied_at` a linha não é “enviada”. Mitigação: seed (KAN-60) deve preencher
  `applied_at` e histórico coerentes — dependência registrada.
- **Risco R3 — Definição de “resposta”.** Excluir `GHOSTED` é interpretação de produto;
  se o humano preferir “qualquer mudança de status”, a taxa muda sem mudança de
  schema. Um único lugar (`RESPONSE` em `metrics/rates.ts`) concentra a regra.
- **Risco R4 — `interviewRate` e entrevistas futuras.** `SCHEDULED` conta como conversão
  mesmo antes de acontecer; `CANCELLED`/`NO_SHOW` não contam. Não há coluna
  “realizada” na spec — não será inventada. A união com status/histórico (ruling R2)
  evita perder quem não registrou entrevista, mas amplia o numerador.
- **Risco R5 — Arredondamento.** Percentual e centavos usam half-up; se o produto exigir
  banker's rounding ou exibição com uma casa, é ajuste de apresentação, não de
  contrato.
- **Risco R6 — XSS no HTML.** Escape é obrigatório em toda emissão e o `href` tem
  allowlist; o risco residual é um caminho de renderização novo que esqueça de
  chamar `escapeHtml`. Mitigação: unit test com payloads (`<script>`, `"><img
  src=x onerror=...>`, `javascript:alert(1)`) e revisão de code review no módulo.
- **Risco R7 — Performance do dashboard.** Quatro consultas + processamento em memória é
  adequado a volume pessoal (centenas de candidaturas). Em dezenas de milhares,
  o dwell em memória e o `bySkill` por `job_skill` precisariam de pré-agregação —
  fora do escopo desta sprint, registrado.
- **Risco R8 — `UNIQUE (application_id, round)`.** Importação, seed ou `PATCH`
  concorrente podem colidir; a tradução de `ER_DUP_ENTRY` para `409` precisa ser
  seletiva pelo nome do índice (padrão do ADR 0005 `:316`), senão um `500` vaza.
- **Risco R9 — `FK_interviews_application = CASCADE`.** Hoje é inerte: não há
  `DELETE /v1/applications/:id` nem hard delete de usuário. Se uma exclusão física
  de candidatura for criada no futuro, o `CASCADE` removerá as entrevistas filhas
  junto, sem `ER_ROW_IS_REFERENCED_2` — decisão adotada pelo ruling R5; o portão
  humano pode revisar, mas a alternativa `RESTRICT` + `409` ficaria para ADR futuro.
- **Risco R10 — `sprint-06.md` em paralelo.** O product-owner pode nomear campos ou rotas
  de forma diferente (ex.: `interviewId` vs `id`, percentual vs razão). A tabela de
  Resolução de conflitos prevalece até o portão; nenhuma alteração silenciosa.
- **Risco R11 — `meeting_url` como superfície de saída.** A URL é armazenada e devolvida
  em JSON e (potencialmente) em `href`; validação de esquema na entrada e no
  renderizador é defesa em profundidade, mas não garante que o destino seja seguro.

## Resolução de conflitos

Onde spec, backlog, `sprint-06.md` e este ADR divergirem na redação, prevalece esta
tabela até o portão humano. Nenhum item abaixo altera decisão fixada pelo tech lead
sem sinalizá-lo explicitamente.

| # | Tema | Fontes em conflito | Decisão adotada | Justificativa verificável |
|---|---|---|---|---|
| 1 | Local do export | Spec `:363-372,:524` inclui export na Fase 3; backlog `:134-142` o coloca em KAN-50/51 (Sprint 6); ADR 0005 decisão 1 adiou | **Export na Sprint 6**, em `GET /v1/resume-versions/:id/export` | Escopo do backlog é o mais recente; nenhuma rota é adicionada à Sprint 5 |
| 2 | `format` obrigatório | Spec `:372` é explícita | **Obrigatório, `json\|html`, sem default, `400` caso contrário** | Teste: `GET .../export` sem query → `400`; `?format=pdf` → `400`; `?format=html` → `200` |
| 3 | Fonte do `atsScore` | Spec `:366` pede `atsScore`; `resume_versions.ats_score` é sempre `NULL` (ADR 0005 decisão 11) | **Última `ats_analyses.score`; `null` se não houver análise** | Duas análises → devolve a segunda; versão sem análise → `200` com `null`; `resume_versions` intocada |
| 4 | Forma do JSON de export | Spec `:366` diz “snapshot + metadados”, sem envelope | **`{ resumeId, version, atsScore, contentSnapshot }`** | Snapshot aninhado não colide com metadados; teste compara `contentSnapshot` com o JSON persistido |
| 5 | Nome físico da tabela de entrevistas | Spec `:144` usa `interview`; decisão 4 do tech lead fixa `interviews` | **`interviews` + `@Entity('interviews')` + `Interview`; FK `FK_interviews_application`** | Padrão plural do projeto; nome de FK já pressupõe plural; conceito da spec preservado |
| 6 | `user_id` em entrevistas | Spec não lista; `:429` exige escopo | **Sem coluna; ownership por `application_id → applications.user_id`** | Nenhum DTO aceita `userId`; entrevista alheia → `404`; teste de isolamento entre usuários |
| 7 | Timestamps de entrevistas | Spec `:144-145` não lista `created_at`/`updated_at`; convenção `:79` e todas as tabelas mutáveis do projeto têm | **Incluir ambos como campos de infraestrutura (ruling R8)** | `created_at` dá ordem estável; `updated_at` audita `PATCH`; não entram em DTO de request |
| 8 | Índice de entrevistas | Ruling R6 mantém `IX_interviews_application_round_scheduled`; versão anterior do ADR o suprimia por redundância de prefixo | **`UQ_interviews_application_round (application_id, round)` + `IX_interviews_application_round_scheduled (application_id, round, scheduled_at, id)` na mesma migration** | A `UNIQUE` cobre só `(application_id, round)` e deixa `scheduled_at, id` para *filesort*; `EXPLAIN` sem `Using filesort` comprova o índice de quatro colunas |
| 9 | Ação da FK de entrevistas | Versão anterior do ADR e decisão 4 registravam `RESTRICT`; ruling R5 fixou `CASCADE` | **`CASCADE` (ruling R5)** | Consistência com `application_status_history` e entrevista como registro filho; hoje inerte (sem `DELETE` de candidatura); `Risco R9` documentado |
| 10 | Nullabilidade de entrevistas | Spec não marca nullable; versão anterior do ADR tornava duração opcional | **Obrigatórios (ruling R9):** `round`, `type`, `scheduled_at`, `durationMinutes` (1..1440), `status`, `outcome`; **nullable:** entrevistador, link, feedback (≤ 5000) | `durationMinutes` é conhecido no agendamento e exigido pelo DTO; `PENDING`/`SCHEDULED` justificam-se pelos enums `:174-175` |
| 11 | Listagem de entrevistas | Convenção global `{ data, meta }` (`:430`) vs recurso aninhado de cardinalidade mínima | **Array simples, ordem `round ASC, scheduled_at ASC, id ASC`** | Sem paginação inventada; precedente `GET /v1/companies` (ADR 0003 `:239`); ordem total e determinística |
| 12 | Estado da entrevista | Spec define máquina só para candidatura (`:180-194`) | **Sem máquina de estados; `status`/`outcome` mutáveis** | Não inventar transições; qualquer valor do enum é aceito; registrado no portão |
| 13 | Início do funil | Spec `:529` não define; ADR 0004 decisão 5 rejeitou `applied_at` **para filtros de listagem** | **Dashboard usa `applied_at` primeiro, com fallback para a 1ª transição `APPLIED` (ruling R3);** `created_at` fica só para a âncora `SAVED` do dwell | Motivo é oposto ao do filtro: aqui o objetivo é excluir `SAVED`; sem marco, a candidatura sai da amostra de primeira resposta |
| 14 | Definição de “resposta” | Spec `:529` nomeia a taxa sem definir | **Status atual OU histórico (ruling R11): `SCREENING, SCHEDULED, INTERVIEW, OFFER, HIRED, REJECTED`; `GHOSTED`, `WITHDRAWN`, `CANCELLED` fora** | `GHOSTED` significa ausência de resposta; ações do candidato não são resposta; dados sem histórico não são penalizados |
| 15 | Definição de “oferta” | Spec `:529` | **Status atual OU histórico (ruling R11): `OFFER`/`HIRED`** | `OFFER → REJECTED` não apaga a oferta; `HIRED` incluído por robustez |
| 16 | Definição de “entrevista” | Spec `:529` | **União (ruling R2): `interviews.status ∈ {SCHEDULED, COMPLETED}` OU status/histórico em `{INTERVIEW, OFFER, HIRED}`; `CANCELLED`/`NO_SHOW` fora da tabela** | Não penaliza quem não registrou entrevista; a tabela é o evento, o status é o marco alternativo |
| 17 | Unidade/arredondamento das taxas | Spec omite | **Percentual 0..100, 2 casas half-up; `null` se denominador 0; `numerator`/`denominator` internos; resposta expõe apenas `responseRate`, `interviewRate`, `offerRate` e `submitted` (ruling R1)** | `1/3` → `33.33`; `0/0` → `null`; teste unitário da função `rate` |
| 18 | `countsByStatus` com zeros | Spec `:529` “contagem por status” | **11 chaves sempre presentes, ordem do enum, zeros inclusos** | Contrato estável; soma = `totalApplications`; teste com banco vazio devolve 11 zeros |
| 19 | Tempo até a primeira resposta | Spec `:529` sem definição | **`applied_at` (00:00 UTC) quando presente, fallback = 1ª transição `APPLIED`; fim = 1ª transição de resposta; deltas negativos excluídos; média em dias, 2 casas; `null` sem amostra (ruling R3)** | Respeita a precedência do marco de envio e descarta pares corrompidos; sem marco, a candidatura é excluída |
| 20 | Tempo por etapa | Spec `:529` sem definição | **Segmentos fechados entre transições, âncora `(SAVED, created_at)`, último segmento excluído, média por status, `null` se 0 amostras** | Determinístico e testável; terminais sem amostra é honesto |
| 21 | Agrupamento de compensação | Decisão 5 fala só em moeda; spec `:138` tem `salary_period` | **Bucket `(currency, salary_period)`** | `AVG` entre mensal e anual é 12× errado; moeda e período são a mesma classe de erro |
| 22 | Diferença proposto × ofertado | Spec `:530` pede absoluta e percentual | **Amostra pareada; `absoluteCents` inteiro; `percentage` 2 casas; `null` sem pares ou proposto médio 0** | Não compara populações distintas; `pairedSampleSize` permite auditar |
| 23 | `bySeniority` com vaga sem senioridade | `jobs.seniority` nullable | **Bucket `seniority: null`** | Soma reconcilia com `byCurrency`; nenhum dado descartado |
| 24 | `bySkill` | Spec `:530` “média por skill” | **Skills da vaga (`job_skill`), expandidas; sem reconciliação** | Uma candidatura tem N skills; total por skill não é total de candidaturas |
| 25 | Índices adicionais | Pedido para avaliar performance | **Nenhuma migration adicional: `UQ_interviews_application_round` e `IX_interviews_application_round_scheduled` ficam na migration de `interviews` (ruling R6)** | Índices existentes cobrem os filtros; `EXPLAIN` sem `type: ALL` e sem `Using filesort`; `schema:log` sem drift |
| 26 | `projects` no HTML | Spec `:371` fixa seis títulos; snapshot tem `projects` | **Não renderizar `projects` nesta sprint** | Fora dos títulos fixados; campo é `[]` por construção (ADR 0005 `:408`) |
| 27 | Rodapé do HTML | Não previsto na spec; versão anterior do ADR previa versão/data | **Sem rodapé, sem `version`, sem `generatedAt` (ruling R10)** | Determinismo byte-a-byte; metadados ficam no JSON, não no documento |
| 28 | Timestamp da migration | Cadeia `…1795046400000`, `1795737600000` | **`1795824000000-CreateInterviewDomain`** | Passo de 86.400.000 ms usado na série; ordem crescente em `migration:show` |
| 29 | `duration_minutes` | ADR anterior dizia nullable; sprint/decisão 11 exigem 1..1440 | **Obrigatório (ruling R9)** | Evita `NULL` em agendamento; DTO e migration já alinhados |
| 30 | `<title>` do HTML | ADR anterior `Currículo — {targetRole} — {name}`; código/sprint `{name} — Currículo` | **`{name} — Currículo`, fallback `{targetRole} — Currículo` (ruling R10)** | Exemplo concreto da sprint e teste de determinismo seguem este formato |
| 31 | `mailto:` no HTML | ADR anterior permitia; sprint e código não | **Apenas `http`/`https` em `href`; e-mail como texto (ruling R10)** | Reduz superfície de saída; nenhum requisito da spec pede `mailto:` |
| 32 | Amostra de `averageTimeToFirstResponseDays` | ADR anterior restringia a `S`; fallback do ruling R3 usa transição `APPLIED` | **`U`, não `S` (ruling R12)** | Candidatura sem `applied_at` mas com transição `→ APPLIED` entra só neste cálculo |
| 33 | Limite de `feedback` | ADR A12 previa 5000; DTO não aplicava | **`@MaxLength(5000)` em POST e PATCH (ruling R13)** | Evita estouro da coluna `text` e 500; contrato canônico A12 preservado |

## Validação

Este ADR não executa comandos (regime da linha 8), mas a sprint foi validada pelo
time: a tabela abaixo registra os **resultados reais** consolidados pelo tech lead
a partir das execuções de tsc, lint, build, testes unitários/e2e e migrations.
`EXPLAIN` e demo manual permanecem como portão humano.

| Verificação | Critério objetivo | Status |
|---|---|---|
| `npx tsc --noEmit` | exit 0, sem `any` novo | ✅ exit 0 |
| `npm run lint` | exit 0 (warnings preexistentes não contam como novos) | ✅ exit 0; 1 warning pré-existente em `test/auth.e2e-spec.ts:232` (`require-array-sort-compare`) |
| `npm run build` | exit 0 | ✅ exit 0 |
| `npm test` | unit tests novos verdes, incluindo `rate`, `dwell`, `pairedDifference`, `escapeHtml`, `renderResumeHtml` | ✅ 36 arquivos / 387 testes |
| `renderResumeHtml` determinístico | duas chamadas com a mesma fixture → strings idênticas | ✅ green (unit + e2e) |
| XSS do HTML | fixture com `<script>`, `"><img onerror=...>` e `javascript:alert(1)` não produz tag/atributo executável | ✅ green (unit + e2e) |
| Export JSON | `contentSnapshot` igual ao persistido; `atsScore` = última análise; `null` sem análise | ✅ green |
| Export `format` | ausente/`pdf`/duplicado → `400`; `json`/`html` → `200` com `Content-Type` correto | ✅ green |
| Isolamento | usuário B em versão/candidatura/entrevista de A → `404` em todas as rotas novas | ✅ green (e2e) |
| Entrevistas | CRUD completo; `round` duplicado → `409`; `PATCH` para rodada ocupada → `409`; `DELETE` → `204` | ✅ green (e2e 46/46, incluindo query `?_noQueryParams=` vazio/proibido) |
| `summary` vazio | usuário sem candidaturas → 11 zeros, taxas `null`, médias `null`, `sampleSize` 0 | ✅ green (e2e) |
| `summary` fixture | 24 candidaturas do exemplo → contagens, taxas, média e dwell exatamente como calculado neste ADR | ✅ green (e2e) |
| `compensation` | BRL e USD nunca no mesmo item; MONTH e YEAR nunca no mesmo item; `difference` só com pares | ✅ green (e2e) |
| `npm run test:e2e` | suíte completa com MySQL local | ✅ 10 arquivos / 357 testes |
| Migration | `run` → `revert` → `run` → `show` com 6 migrations `[X]` | ✅ `run` → `revert` → `run` → `show` concluído |
| `schema:log` | sem drift; `SHOW INDEX FROM interviews` = PK + `UQ_interviews_application_round` + `IX_interviews_application_round_scheduled` | ✅ sem drift; índices conferidos na migration |
| `EXPLAIN` | consultas 1–4 sem `type: ALL` em `applications`/`application_status_history` e listagem de entrevistas sem `Using filesort` | ⏳ pendente — humano (não executamos) |
| Demo manual | criar entrevista, exportar JSON/HTML, abrir dashboard | ⏳ pendente — humano |

## Checklist para o backend-dev

- [ ] Criar `1795824000000-CreateInterviewDomain.ts` (classe
      `CreateInterviewDomain1795824000000`) com a tabela `interviews`, colunas,
      enum, `UNIQUE (application_id, round)`,
      `IX_interviews_application_round_scheduled (application_id, round, scheduled_at, id)`
      e `FK_interviews_application ... ON DELETE CASCADE` exatamente como em Modelo
      de dados; `synchronize: false`.
- [ ] Criar `Interview` com `@Entity('interviews')`, `@CreateDateColumn`/
      `@UpdateDateColumn`, e a entidade sem `userId`; enums
      `InterviewType`/`InterviewStatus`/`InterviewOutcome` em
      `src/common/enums/` com membro = próprio valor.
- [ ] Implementar `interviews` module (`dto/`, `entities/`, `*.module.ts`,
      `*.controller.ts`, `*.service.ts`, `*.spec.ts`) com `@Controller('applications/:applicationId/interviews')`;
      não alterar `applications.controller.ts`.
- [ ] Garantir ownership por join em **todas** as operações, inclusive
      `interviewId` pertencente à candidatura do path; alheio/inexistente → `404`.
- [ ] Traduzir `ER_DUP_ENTRY` de `UQ_interviews_application_round` para `409` e
      nenhum outro `ER_DUP_ENTRY`; pré-checar no `PATCH` de `round`.
- [ ] Implementar `GET /v1/resume-versions/:id/export` com `ExportFormatDto`
      (`@IsIn(['json','html'])`, sem default, sem campo extra) → `400`; Swagger com
      `produces` dos dois tipos.
- [ ] JSON: `{ resumeId, version, atsScore, contentSnapshot }`; `atsScore` da
      última análise por `createdAt DESC, id ASC`, `null` se ausente; **nunca** ler
      `resumeVersionsRepository` para score nem escrever nada.
- [ ] HTML: módulo puro em `src/modules/resumes/export/`, sem dependência nova,
      sem `Date.now`/`Intl`, com escape em toda emissão, allowlist `http|https`
      (ruling R10; sem `mailto:`), seis títulos fixos, omissão de bloco vazio e
      `Content-Type: text/html; charset=utf-8`.
- [ ] Dashboard: `src/modules/dashboard/` com `metrics/` puro; `countsByStatus`
      com os 11 status na ordem do enum; taxas em percentual 0..100 com 2 casas,
      half-up, `null` com denominador 0; `numerator`/`denominator` são variáveis
      internas do cálculo — a resposta expõe apenas `responseRate`, `interviewRate`,
      `offerRate` e `submitted` (ruling R1).
- [ ] `summary`: universo `U` = candidaturas do usuário; `S` = `applied_at IS NOT
      NULL`; resposta/oferta pelo status atual **ou** histórico com os conjuntos
      deste ADR (ruling R11); entrevista por união entre
      `interviews.status IN ('SCHEDULED','COMPLETED')` e status/histórico em
      `{INTERVIEW, OFFER, HIRED}` (ruling R2); primeira resposta com `applied_at`
      antes do fallback de transição `APPLIED` (ruling R3, amostra `U` por R12);
      dwell com âncora `(SAVED, created_at)` e último segmento excluído.
- [ ] `compensation`: bucket `(currency, salary_period)`; `stats` por campo;
      `difference` pareado com `pairedSampleSize`; `bySeniority` com bucket `null`;
      `bySkill` por `job_skill`, ordenado; sem total global.
- [ ] Rejeitar qualquer query string nos dois endpoints de dashboard (`400` com
      `Unsupported query parameters`).
- [ ] Centavos via helper existente (`bigintCentsToNumber`), nunca `Number()` cru;
      médias arredondadas uma única vez.
- [ ] Nenhuma migration **adicional** de índice — os dois índices de `interviews` vão
      na migration `CreateInterviewDomain`; nenhuma alteração em `applications`,
      `resume_versions`, `ats_analyses` ou outras tabelas existentes; nenhum
      `UPDATE` em `resume_versions.ats_score`.
- [ ] Não implementar seed, PDF, DOCX, upload, filtro de período, paginação de
      entrevistas ou histórico de entrevistas.
- [ ] Preencher a seção Validação com resultados reais; entregar sem commit e
      aguardar revisão, demo e decisão humana.

## Portão humano

### (i) Decisões técnicas do architect — adotadas, registradas para ciência

Não bloqueiam a implementação; são escolhas de engenharia dentro do espaço deixado
pela spec e pelas decisões do tech lead. Mudá-las é ajuste documentado neste ADR,
não alteração silenciosa de código.

| # | Decisão | Efeito prático |
|---|---|---|
| A1 | `contentSnapshot` aninhado no JSON de export | Snapshot no topo não é devolvido; metadados não colidem |
| A2 | `atsScore` = análise mais recente, `null` sem análise | Rota devolve `200` com `null` onde `GET .../analysis` devolve `404` |
| A3 | HTML omite `projects`, `version`, `generatedAt` e rodapé (ruling R10) | Nenhum dado real perdido hoje (`projects` é `[]`); determinismo preservado |
| A4 | `UQ_interviews_application_round` + `IX_interviews_application_round_scheduled` (ruling R6) | `interviews` tem PK + UNIQUE + índice de 4 colunas; sem *filesort* |
| A5 | Listagem de entrevistas em array simples, sem paginação | Foge do envelope global; justificado por cardinalidade |
| A6 | `difference` da compensação por amostra pareada | `difference` não é `offered.avg - proposed.avg` exibidos |
| A7 | Bucket `(currency, salary_period)` | Resposta tem um item por par, não por moeda |
| A8 | `bySeniority` com bucket `seniority: null`; `bySkill` sem reconciliação | Totais de senioridade fecham; totais de skill não |
| A9 | Dwell com âncora `(SAVED, created_at)` e segmento aberto excluído | `SAVED` tem média; terminais ficam com `sampleSize = 0` |
| A10 | `applied_at` primeiro; fallback para a 1ª transição `APPLIED` (ruling R3) | Tempo até resposta existe mesmo sem histórico, com erro intradiário apenas no fallback |
| A11 | `meeting_url` com allowlist `http`/`https` na entrada e no `href` | Esquemas ativos são recusados com `400`/renderizados como texto |
| A12 | `feedback` limitado a 5000 caracteres no DTO | Guarda de abuso; coluna continua `text` |
| A13 | Filtros de período ausentes no dashboard | Rotas não aceitam query; `400` em qualquer parâmetro |

### (ii) Interpretações que precisam de confirmação do humano

| # | Ambiguidade | O que foi decidido | Pergunta ao humano |
|---|---|---|---|
| H1 | `resume_versions.ats_score` vs. export | Coluna continua `NULL`; export lê `ats_analyses` | Confirmar que a spec `:522` não obriga preencher a coluna (reabriria a imutabilidade do ADR 0005) |
| H2 | Definição de “resposta” | `GHOSTED` **não** conta como resposta; `WITHDRAWN`/`CANCELLED` também não | Ratificar a leitura de que “ghosted” é ausência de resposta |
| H3 | Definição de “entrevista” | União (ruling R2): `SCHEDULED`/`COMPLETED` na tabela **ou** `INTERVIEW`/`OFFER`/`HIRED` no status/histórico; `CANCELLED`/`NO_SHOW` não | Confirmar se a união é desejada para não penalizar quem não registrou entrevista |
| H4 | Definição de “oferta” | Status atual **ou** histórico (ruling R11): `OFFER` ou `HIRED` | Confirmar se `HIRED` deve contar separadamente em outra métrica |
| H5 | Unidade das taxas | Percentual 0..100 com 2 casas | Confirmar que o cliente/portfólio espera percentual, não razão 0..1 |
| H6 | `countsByStatus` com zeros | 11 chaves fixas | Confirmar formato de objeto (vs. array) para o gráfico |
| H7 | Tempo por etapa | Segmentos fechados; tempo na etapa atual não entra | Confirmar se o dashboard deve mostrar “dias na etapa atual” como campo separado (nova história) |
| H8 | `interviews.created_at`/`updated_at` | Incluídos, desvio textual da spec | Ratificar o desvio ou exigir colunas exatamente como `:144-145` |
| H9 | Nullabilidade de entrevistas | `durationMinutes` obrigatório (ruling R9); entrevistador/link/feedback nullable; `outcome` default `PENDING`; `status` default `SCHEDULED` | Confirmar se os campos opcionais devem ser obrigatórios no agendamento |
| H10 | Sem máquina de estados para entrevista | `status`/`outcome` livres; `DELETE` de `COMPLETED` permitido | Confirmar se deve haver transições/validações (ex.: `COMPLETED` exige `feedback`) |
| H11 | `UNIQUE (application_id, round)` | `409` em rodada repetida | Confirmar se rodadas podem repetir (ex.: duas “técnicas” na mesma rodada) |
| H12 | `FK_interviews_application = CASCADE` | Decisão final do tech lead (ruling R5, confirmada no Risco R9); inerte hoje porque não existe `DELETE` de candidatura | Confirmar se uma futura exclusão física deve remover entrevistas filhas; alternativa `RESTRICT` + `409` ficaria para ADR futuro |
| H13 | Listagem de entrevistas | Array simples, sem `{ data, meta }` | Confirmar alinhamento com a convenção global de paginação `:430` |
| H14 | Bucket de compensação | `(currency, salary_period)`; sem normalização para mensal | Confirmar se o produto prefere normalizar períodos (regra a especificar) |
| H15 | Diferença pareada | Só candidaturas com proposto **e** ofertado | Confirmar se a diferença deve usar as médias populacionais exibidas |
| H16 | Escopo de compensação | Status não filtra; `jobs.salary_range_*` ignorado | Confirmar se candidaturas `WITHDRAWN`/`CANCELLED` devem sair e se a faixa da vaga deve aparecer |
| H17 | `bySkill` | Skills da vaga, expansão múltipla, sem reconciliação | Confirmar se a métrica deve ser por skill da vaga ou do perfil |
| H18 | HTML sem `projects` | Seis títulos fixos de `:371` | Confirmar se “Projetos” deve ser um sétimo título quando houver dados |
| H19 | Fallback de `applied_at` | Usado quando falta histórico | Confirmar se o seed (KAN-60) deve garantir histórico completo em vez de depender do fallback |
| H20 | Filtro de período no dashboard | Não existe; query extra → `400` | Confirmar se `?from=&to=` entra em história futura |
| H21 | `sprint-06.md` paralelo | ADR escrito sem o documento; conflitos resolvidos pela tabela acima | Product-owner/tech lead reconciliam nomenclatura e critérios Given/When/Then |

## Referências

- `docs/prompt-kandid.md:135-145` (`application` e `application_status_history`),
  `:144-145` (entidade `interview`), `:159-176` (enums, incluindo `InterviewType`,
  `InterviewStatus`, `InterviewOutcome`), `:178-203` (máquina de estados e regras de
  `applied_at`/`closed_at`), `:306-372` (snapshot, export e títulos de seção),
  `:374-437` (rotas `/v1`, convenções de auth/ownership/paginação/erros), `:516-534`
  (Fases 3 e 4), `:536-551` (testes mínimos, incluindo “criar → gerar versão →
  analisar → exportar JSON/HTML”).
- `docs/backlog.md:120-132` (fechamento da Sprint 5), `:134-142` (E5 — KAN-50..54),
  `:144-151` (E6 — seed e hardening na Sprint 7).
- `docs/adr/0005-sprint-5-resumes-ats.md:9` (regime de validação), `:29-35`
  (plural físico/singular na entidade), `:59-97` (modelo de `resume_versions` e
  `ats_analyses`), `:102-110` (critério de não redundância de índices), `:117`
  (`ats_score` sempre `NULL`), `:149` (última análise e ordem), `:282-312`
  (resolução de conflitos), `:423-449` (portão humano).
- `docs/adr/0004-sprint-4-applications.md:74-158` (modelo de `applications`,
  `application_status_history` e índices), `:160-203` (enums e transições),
  `:300-328` (transação de status e histórico), `:518-542` (portão humano).
- `docs/adr/0003-sprint-3-pipeline.md:239` (listagem simples de empresas),
  `:304-407` (migration, plural, FKs e índices), `:553-570` (portão humano).
- Código consultado apenas para leitura: `applications.entity.ts` (colunas e
  `bigint` como string), `application-status-history.entity.ts` (append-only),
  `applications.service.ts:137-233` (criação sem histórico inicial e transição com
  `applied_at`/`closed_at`), `resume-version.entity.ts`, `resumes.controller.ts`,
  `ats-analysis.service.ts` (ownership por join e última análise),
  `job.entity.ts` (`seniority` nullable).
- `AGENTS.md` (convenções, `.env` proibido, parada antes de commit) e
  `kandid_api/AGENTS.md` (comandos de qualidade, dinheiro em centavos, escopo por
  usuário).
