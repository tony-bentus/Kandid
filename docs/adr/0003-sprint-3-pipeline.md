# ADR 0003 — Modelo de dados e contratos da Sprint 3 (empresas, recrutadores e vagas)

- Status: Accepted
- Data: 2026-11-18
- Decisores: architect (parecer), tech lead (confirmações e resolução de conflitos) e Antônio/time Kandid
- Fechamento local: 2026-11-18 — implementado em `feat/sprint-2-profile` (HEAD `00b0647`, uncommitted); ciclo de migration revert→run→`schema:log` validado localmente; pendem validação humana (testes, demo e commit/push/PR/merge/deploy)

## Contexto

A Sprint 3 cobre KAN-20 (CRUD de empresas), KAN-21 (CRUD de recrutadores) e KAN-22
(CRUD de vagas com stack e faixa salarial) (`docs/backlog.md:60-62`). A fonte da
verdade do domínio é `docs/prompt-kandid.md:119-133` (entidades), `:159-176`
(enums), `:374-431` (API) e `:508-514` (Fase 2). O código já implementado fornece
os padrões a seguir, que este ADR preserva:

- migrations versionadas e `synchronize: false`; a cadeia local termina em
  `1794960000000-CreatePipelineDomain` (`src/database/migrations/1794960000000-CreatePipelineDomain.ts`),
  após `1794268800000-CreateProfileDomain`;
- tabelas em **plural** (`profiles`, `profile_skills`), embora a spec use nomes
  singulares — a migration existente é o padrão factual do banco;
- `userId` sempre do JWT (`@CurrentUser()`), nunca do body;
  `ValidationPipe` com `whitelist`/`forbidNonWhitelisted` (`src/main.ts:17-19`);
- `hasField`/`assertNoForcedNull` para PATCH e `normalizeOptionalString` para
  limpar opcionais (`src/common/utils/null-fields.ts`,
  `src/modules/profiles/profiles.service.ts:29-54`);
- centavos como `bigint` convertidos por `src/common/utils/money.ts`, com
  `RangeError` traduzido para `400` no service
  (`src/modules/profiles/profiles.service.ts:160-181`);
- `isDuplicateEntry(error, fragment)` para traduzir **somente** a constraint
  conhecida (`src/common/utils/is-duplicate-entry.ts`, ADR 0002 decisão 6);
- enums como string enums em `src/common/enums/`; `Seniority`, `WorkModel` e
  `ContractType` já existem;
- datas `YYYY-MM-DD` preservadas por `extra: { dateStrings: ['DATE'] }`
  (ADR 0002 decisão 4).

Pontos ambíguos que exigem decisão antes da implementação:

1. A spec marca apenas `company.size` como nullable, mas o mesmo padrão de
   escrita da spec foi relaxado na Sprint 2 para campos descritivos de `profile`.
2. `recruiter.email` aparece sem marcador de nulabilidade.
3. `job.description`, `location` e `notes` também aparecem sem marcador, e a
   própria spec lista `?status` na rota de vagas sem existir `job.status`.
4. `job_skill` não tem ID próprio na spec, mas precisa entrar no payload de
   criação/atualização da vaga.
5. Os helpers de dinheiro mencionam `desiredSalaryCents` nas mensagens de erro.

Este ADR registrou o contrato para o backend-dev. A implementação foi concluída
localmente em 2026-11-18 na branch `feat/sprint-2-profile`; os desvios decididos
pelo tech lead têm precedência sobre o texto original onde divergirem e estão
consolidados na seção abaixo. Nenhuma alteração de código, migration, commit ou
deploy foi feita por este documento.

## Resolução de conflitos (tech lead, 2026-11-18)

O tech lead decidiu os cinco pontos em que este ADR divergia do documento da
Sprint 3. A implementação segue esta seção; as demais decisões permanecem.

| Tema | Decisão adotada | Justificativa |
|---|---|---|
| Exclusão de empresa com vagas | `ON DELETE RESTRICT` em `jobs.company_id` + checagem no service → `409` | Evita perda silenciosa de histórico; substitui o `CASCADE` proposto na Decisão 10 |
| `?companyId=` alheio/inexistente em `GET /v1/jobs` | envelope vazio (`total: 0`), sem `404` | Filtro de coleção apenas estreita resultados; `404` fica reservado a acesso por `:id` |
| `?sort=` em `GET /v1/jobs` | `400` | O humano aprovou apenas `companyId`, `seniority`, `skillId`, `q`, `page` e `limit`; ordenação é fixa |
| `skillId` repetido no array `skills` | `400` (payload malformado), antes de qualquer escrita | Duplicata no payload não é conflito com estado persistido; `409` fica para corrida em `job_skills` |
| Filtro `q` | somente `title` e `description` | Incluir `company.name` ampliaria o contrato sem aprovação |

As quatro confirmações levantadas pelo architect — campos descritivos de
`company` anuláveis, `recruiter.email` opcional normalizado, `?status` rejeitado
com `400` e `description`/`location` de `job` anuláveis — foram adotadas como
decisão de implementação. Todas seguem sujeitas à validação humana no portão
final (revisão, demo e testes), conforme a seção de aprovação ao fim deste ADR e
`docs/sprints/sprint-03.md`.

## Decisão

### 1 — Nullabilidade de `company` (KAN-20)

Tabela `companies` (plural, conforme a migration existente).

| Coluna | Decisão |
|---|---|
| `id`, `user_id`, `created_at`, `updated_at` | obrigatórios (padrão do projeto) |
| `name varchar(160)`, `kind enum` | **NOT NULL** |
| `website varchar(255)`, `industry varchar(120)`, `location varchar(160)`, `notes text` | **NULL** |
| `size enum` | **NULL** (como na spec) |

Critério: o valor mínimo aceitável para cadastro é `{ name, kind }`. Campos
descritivos são enriquecimento posterior, exatamente como `headline`, `city`,
`phone` e `summary` em `profiles` ficaram anuláveis na Sprint 2. Exigir todos os
campos da spec tornaria o CRUD de empresas mais rígido que o de perfil, sem ganho
de integridade: nenhum deles participa de regra de negócio ou constraint.

`name` é gravado com `trim()` (**sem** lowercase), preservando a exibição. A
UNIQUE usará a collation `utf8mb4_0900_ai_ci` da migration anterior, portanto
`Acme`, `acme` e `Ácme` colidem — ver risco R3 e spike no fim.

### 2 — `recruiter` (KAN-21)

| Coluna | Decisão |
|---|---|
| `name varchar(120)` | **NOT NULL** |
| `email varchar(160)` | **NULL**; se enviado, `@IsEmail()` + `normalizeEmail()` (`trim().toLowerCase()`) |
| `phone varchar(30)`, `linkedin_url varchar(255)`, `notes text` | **NULL** |
| `agency_company_id varchar(36)` | **NULL**, FK para `companies.id` |

`email` é dado de contato, não identidade do domínio: é comum cadastrar um
recrutador apenas com LinkedIn. Segue a mesma lógica de relaxamento de campos
descritivos adotada em `profiles` (Decisão 1). **Não há UNIQUE em e-mail**, porque
a spec não define essa constraint e dois usuários podem, legitimateamente,
cadastrar a mesma pessoa.

`agency_company_id`, quando informado, deve apontar para uma empresa do **mesmo
`userId`**. A checagem é explícita
(`companiesRepository.findOne({ where: { id, userId } })`); ausência → `404`
antes de qualquer `save()`. Não é exigido que `company.kind === AGENCY`, pois essa
regra não está na spec (registrada como risco R6).

### 3 — `job` (KAN-22)

Obrigatórios no POST:

- `companyId` (UUID de empresa do mesmo usuário);
- `title varchar(160)`;
- `source` (enum `JobSource`);
- `salaryPeriod` (enum `SalaryPeriod`) — obrigatório **mesmo quando os valores
  salariais estiverem vazios**, conforme a spec `:129`.

Opcionais / default:

- `currency char(3)`: `NOT NULL DEFAULT 'BRL'`, validado como `/^[A-Z]{3}$/`;
- `recruiterId`, `description`, `seniority`, `workModel`, `contractType`,
  `location`, `sourceUrl`, `salaryRangeMinCents`, `salaryRangeMaxCents`,
  `postedAt`, `applicationDeadline`, `notes`: **NULL**;
- `description` e `location` são opcionais pela mesma razão da Decisão 1; a spec
  não os marca como nullable, mas também não os usa em regra alguma.

Regras verificáveis no service:

- `companyId` e `recruiterId` precisam pertencer ao `userId` do JWT; senão `404`.
- Se `salaryRangeMinCents` e `salaryRangeMaxCents` forem ambos informados,
  `min <= max`; caso contrário `400`.
- `postedAt` e `applicationDeadline` usam `@IsDateOnly()`
  (`src/common/validators/is-date-only.validator.ts`) e formato `YYYY-MM-DD`.
- Nenhum DTO declara `userId`; um `userId` no body é rejeitado com `400` pelo
  `forbidNonWhitelisted`.

### 4 — `job_skill` embutido no payload da vaga

Não haverá módulo, controller nem rota para `job_skill`. O vínculo é parte do
contrato de `job`:

```json
"skills": [
  { "skillId": "uuid-do-catalogo", "isRequired": true },
  { "skillId": "outro-uuid", "isRequired": false }
]
```

- `skills` é opcional no POST e no PATCH; `isRequired` default `true`.
- Array vazio é válido e significa "vaga sem stack declarada" / "limpar stack".
- `skillId` deve existir no catálogo global (`skills`); ausente → `404`.
- `skillId` repetido no mesmo array → `400` **antes** de qualquer escrita.
- **PATCH com substituição atômica**: se `skills` estiver presente, o service
  abre transação, adquire `pessimistic_write` na linha de `jobs`, remove todas as
  linhas de `job_skills` daquela vaga e insere o conjunto enviado. Se `skills`
  estiver ausente, a stack atual permanece intacta (uso de `hasField`).
- A resposta de `job` inclui `skills` no formato
  `{ skillId, isRequired, skill }`, com o objeto `skill` aninhado (`id`, `name`,
  `slug`, `category`, `aliases`), ordenado por `skill.name` e depois `skill.id` —
  mesma forma de `ProfileSkillResponseDto`, evitando N+1 de consultas na UI.
  O DTO e o service devolvem esse objeto aninhado; não é uma resposta somente
  com `skillId`/`isRequired`.
- Corrida na inserção (duplicata vinda do banco, não do payload) → `409`.

Critério de aceite: um PATCH que troca 3 skills por 2 nunca deixa estado
intermediário observável; uma leitura concorrente vê 3 antes ou 2 depois, nunca
1 ou 4.

### 5 — Faixa salarial e generalização de `money.ts`

Manter um único par de helpers e tornar o nome do campo parametrizável, com
**default preservando as mensagens atuais** (ADR 0002 e `money.spec.ts`):

```ts
export function bigintCentsToNumber(
  raw: string | null,
  fieldName = 'desiredSalaryCents',
): number | null;

export function numberToBigintCents(
  value: number | null,
  fieldName = 'desiredSalaryCents',
): string | null;
```

Mensagens resultantes:

- `salaryRangeMinCents must be between 0 and 9007199254740991`
- `salaryRangeMaxCents must be a non-negative safe integer`

(para `bigintCentsToNumber` e `numberToBigintCents`, respectivamente; o default
`desiredSalaryCents` continua idêntico ao texto atual).

No `JobsService`, `RangeError` vira `BadRequestException`, como já faz
`ProfilesService`. Leitura e escrita dos dois campos usam o `fieldName`
correspondente. `bigint unsigned` + `MAX_SAFE_INTEGER` continuam sendo o limite
do contrato JSON (`number`); valores maiores falham em vez de serem arredondados.

### 6 — Listagem, paginação, filtros e ordenação de vagas

`GET /v1/jobs` usa o envelope da spec `:430`:

```json
{
  "data": [ /* JobResponseDto */ ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

- `page >= 1` (default `1`), `1 <= limit <= 100` (default `20`), com
  `@Type(() => Number)`, `@IsInt()`, `@Min()`/`@Max()` no query DTO.
- `totalPages = Math.ceil(total / limit)`, com `0` quando `total === 0`. Página
  além do fim retorna `data: []` e o `meta` correto — não `404`.
- **Ordenação fixa**: `postedAt DESC` (nulos por último), `createdAt DESC`,
  `id ASC`. Não existe parâmetro `sort`: qualquer `?sort=` resulta em `400`.
- Filtros aceitos: `companyId`, `seniority`, `skillId`, `q`. `companyId` precisa
  ser uma empresa do usuário; empresa alheia ou inexistente devolve envelope
  vazio (`total: 0`), sem `404`. `skillId` filtra via `EXISTS` em `job_skills`,
  usando a PK composta; `q` busca **apenas** `title` e `description` com `LIKE`,
  escapando `%`, `_` e `\` — **sem** `LOWER()` (a collation
  `utf8mb4_0900_ai_ci` já é case/accent-insensitive). `company.name` ficou de
  fora do escopo aprovado.
- **`status` NÃO é aceito em `GET /v1/jobs` nesta sprint.** A spec `:403` o lista,
  mas `job` não tem coluna `status` (`:129`); o único `status` do domínio é de
  `application` (`:137`). Aceitar e ignorar produziria resultado silenciosamente
  errado; inventar uma coluna fugiria da spec. O parâmetro resulta em `400` com
  mensagem listando os filtros suportados. Se o produto quiser "vagas com
  candidatura em determinado status", é outra história, com join em
  `applications` e semântica explícita para vagas sem candidatura.
- `GET /v1/companies?kind=` e `GET /v1/recruiters` continuam devolvendo **array
  simples**, não envelope: a spec só atribui `page`/`limit` à rota de vagas
  (`:401-403`). Uniformizar depois exigiria mudança de contrato nas outras duas
  histórias.

### 7 — Tradução seletiva de `ER_DUP_ENTRY`

| Situação | Resposta |
|---|---|
| `companies.name` duplicado (pré-checagem por `userId` + `name`, ou corrida) | `409 Conflict`, mensagem `Company name already exists` |
| Corrida detectada por `isDuplicateEntry(error, 'UQ_companies_user_name')` | `409 Conflict` |
| `skills` repetido no payload de vaga | `400 Bad Request` (validação antes do banco) |
| Corrida em `job_skills` detectada por `isDuplicateEntry(error, 'job_skills.PRIMARY')` (ou fragmento `PRIMARY` quando a mensagem do driver não incluir o prefixo da tabela) | `409 Conflict`, mensagem `Skill already linked to job` |
| Qualquer outro `QueryFailedError` (`ER_NO_REFERENCED_ROW_2`, `ER_DATA_TOO_LONG`, locks etc.) | `500`, sem vazar SQL — filtro global já faz isso |

A checagem de `job_skills` só é aplicada ao bloco de inserção da transação da
vaga, para que um `PRIMARY` de outra tabela nunca seja confundido com duplicata
de skill. Não será criado um índice UNIQUE redundante ao lado da PK composta.

### 8 — Ownership e códigos HTTP

`userId` é lido de `@CurrentUser()` e copiado para `companies.user_id`,
`recruiters.user_id` e `jobs.user_id`. Nenhum service aceita `userId` externo.
Toda busca individual usa `where: { id, userId }`; recurso alheio ou inexistente
é indistinguível → `404 Not Found`.

Contrato esperado (prefixo `/v1`, Swagger em `/docs`):

| Método e rota | Sucesso | Erros principais |
|---|---|---|
| `POST /v1/companies` | `201` + Company | `400`, `401`, `409` |
| `GET /v1/companies?kind=` | `200` + `Company[]` | `400`, `401` |
| `GET /v1/companies/:id` | `200` + Company | `400` (UUID), `401`, `404` |
| `PATCH /v1/companies/:id` | `200` + Company | `400`, `401`, `404`, `409` |
| `DELETE /v1/companies/:id` | `204` sem body | `400`, `401`, `404`, `409` (vagas vinculadas) |
| `POST /v1/recruiters` | `201` + Recruiter | `400`, `401`, `404` (agência alheia) |
| `GET /v1/recruiters` | `200` + Recruiter[] | `401` |
| `GET /v1/recruiters/:id` | `200` + Recruiter | `400`, `401`, `404` |
| `PATCH /v1/recruiters/:id` | `200` + Recruiter | `400`, `401`, `404` |
| `DELETE /v1/recruiters/:id` | `204` sem body | `400`, `401`, `404` |
| `POST /v1/jobs` | `201` + Job (com `skills`) | `400`, `401`, `404` (empresa/recrutador/skill), `409` |
| `GET /v1/jobs?...` | `200` + `{ data, meta }`; `companyId` alheio/inexistente → `total: 0` | `400` (`status`, `sort` e demais parâmetros fora da whitelist), `401`, `404` (`skillId` inexistente) |
| `GET /v1/jobs/:id` | `200` + Job (com `skills`) | `400`, `401`, `404` |
| `PATCH /v1/jobs/:id` | `200` + Job (com `skills`) | `400`, `401`, `404`, `409` |
| `DELETE /v1/jobs/:id` | `204` sem body | `400`, `401`, `404` |

`GET /v1/jobs/:id/application` está na spec `:404`, mas pertence à história de
candidaturas; não faz parte de KAN-20/21/22. Erros seguem o formato único
`{ statusCode, error, message, path, timestamp }`.

### 9 — Enums novos

Arquivos em `src/common/enums/`, seguindo o padrão de `contract-type.enum.ts`:

| Arquivo | Enum | Valores exatos (spec `:166-171`) |
|---|---|---|
| `company-kind.enum.ts` | `CompanyKind` | `CLIENT`, `AGENCY`, `OTHER` |
| `company-size.enum.ts` | `CompanySize` | `MICRO`, `SMALL`, `MEDIUM`, `LARGE`, `ENTERPRISE` |
| `job-source.enum.ts` | `JobSource` | `LINKEDIN`, `GUPY`, `INDEED`, `REFERRAL`, `COMPANY_SITE`, `OTHER` |
| `salary-period.enum.ts` | `SalaryPeriod` | `MONTH`, `YEAR`, `HOUR`, `DAY` |

JavaScript string enum, membro = próprio valor (`CLIENT = 'CLIENT'`), persistido
como `enum` do MySQL. `Seniority`, `WorkModel` e `ContractType` são reaproveitados
e **não** devem ser recriados.

### 10 — Migration recomendada (especificação, não execução)

**Nome/timestamp:** `1794960000000-CreatePipelineDomain.ts`
(classe `CreatePipelineDomain1794960000000`), sequencial após
`1794268800000-CreateProfileDomain` e correspondente a
`2026-11-18T00:00:00Z`. Todas as tabelas usam
`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`, `id varchar(36)`
com `@PrimaryGeneratedColumn('uuid')`, `created_at`/`updated_at datetime(6)`
com os defaults já usados.

**`companies`**

```text
id                 varchar(36)  NOT NULL PK
user_id            varchar(36)  NOT NULL
name               varchar(160) NOT NULL
kind               enum('CLIENT','AGENCY','OTHER') NOT NULL
website            varchar(255) NULL
industry           varchar(120) NULL
size               enum('MICRO','SMALL','MEDIUM','LARGE','ENTERPRISE') NULL
location           varchar(160) NULL
notes              text NULL
created_at/updated_at datetime(6) NOT NULL

UNIQUE INDEX UQ_companies_user_name (user_id, name)
FK companies.user_id -> users.id ON DELETE CASCADE ON UPDATE NO ACTION
```

**`recruiters`**

```text
id                 varchar(36)  NOT NULL PK
user_id            varchar(36)  NOT NULL
name               varchar(120) NOT NULL
email              varchar(160) NULL
phone              varchar(30)  NULL
linkedin_url       varchar(255) NULL
agency_company_id  varchar(36)  NULL
notes              text NULL
created_at/updated_at datetime(6) NOT NULL

FK recruiters.user_id -> users.id ON DELETE CASCADE ON UPDATE NO ACTION
FK recruiters.agency_company_id -> companies.id ON DELETE SET NULL ON UPDATE NO ACTION
```

**`jobs`**

```text
id                       varchar(36) NOT NULL PK
user_id                  varchar(36) NOT NULL
company_id               varchar(36) NOT NULL
recruiter_id             varchar(36) NULL
title                    varchar(160) NOT NULL
description              text NULL
seniority                enum('INTERN','JUNIOR','MID','SENIOR','LEAD','STAFF','PRINCIPAL') NULL
work_model               enum('ONSITE','HYBRID','REMOTE') NULL
contract_type            enum('CLT','PJ','CONTRACTOR','FREELANCE','INTERNSHIP','TEMPORARY') NULL
location                 varchar(160) NULL
source                   enum('LINKEDIN','GUPY','INDEED','REFERRAL','COMPANY_SITE','OTHER') NOT NULL
source_url               varchar(255) NULL
salary_range_min_cents   bigint unsigned NULL
salary_range_max_cents   bigint unsigned NULL
currency                 char(3) NOT NULL DEFAULT 'BRL'
salary_period            enum('MONTH','YEAR','HOUR','DAY') NOT NULL
posted_at                date NULL
application_deadline     date NULL
notes                    text NULL
created_at/updated_at    datetime(6) NOT NULL

FK jobs.user_id -> users.id ON DELETE CASCADE ON UPDATE NO ACTION
FK jobs.company_id -> companies.id ON DELETE RESTRICT ON UPDATE NO ACTION
FK jobs.recruiter_id -> recruiters.id ON DELETE SET NULL ON UPDATE NO ACTION
INDEX IX_jobs_user_created (user_id, created_at)
INDEX IX_jobs_user_company (user_id, company_id)
INDEX IX_jobs_user_posted (user_id, posted_at)
```

**`job_skills`** (sem `id`, sem timestamps)

```text
job_id       varchar(36) NOT NULL
skill_id     varchar(36) NOT NULL
is_required  tinyint NOT NULL DEFAULT 1

PRIMARY KEY (job_id, skill_id)
FK job_skills.job_id -> jobs.id ON DELETE CASCADE ON UPDATE NO ACTION
FK job_skills.skill_id -> skills.id ON DELETE CASCADE ON UPDATE NO ACTION
```

O `down()` remove FKs em ordem inversa e depois as tabelas `job_skills`, `jobs`,
`recruiters`, `companies`. O `down()` foi corrigido para dropar exatamente os
nomes de FKs criados pelo `up()` (nomes gerados pelo TypeORM), e o ciclo
`migration:revert` → `migration:run` → `schema:log` foi validado localmente.

**Exceções de exclusão (decididas localmente):** as FKs de **propriedade**
(`companies.user_id`, `recruiters.user_id`, `jobs.user_id`) e as PKs de
`job_skills` usam `ON DELETE CASCADE`, conforme o padrão do projeto.
`jobs.company_id` usa `ON DELETE RESTRICT`: empresa com vagas não é removida e o
service responde `409` (decisão do tech lead, substitui o `CASCADE` proposto
anteriormente). As duas FKs **opcionais** (`recruiters.agency_company_id` e
`jobs.recruiter_id`) usam `ON DELETE SET NULL`; `job_skills.skill_id → skills.id`
mantém `CASCADE`. A migration foi revertida e reaplicada no MySQL local para
alinhar os nomes das FKs ao TypeORM, sem drift de schema.

## Critérios verificáveis

1. `POST /v1/companies` com apenas `{ "name": "Acme", "kind": "CLIENT" }`
   retorna `201` com os demais campos em `null`; o DTO sem `name`/`kind` retorna
   `400`.
2. `POST /v1/recruiters` sem `email` retorna `201`; com `email` ele é gravado em
   minúsculas; `agency_company_id` de outro usuário retorna `404`.
3. `POST /v1/jobs` sem `companyId`, `title`, `source` ou `salaryPeriod` retorna
   `400`; min > max retorna `400`; `currency` inválida retorna `400`.
4. PATCH de vaga com `skills` duplicado retorna `400` e não grava nada; com
   `skillId` inexistente retorna `404`; sem `skills` preserva a stack anterior;
   com `skills: []` limpa a stack. Teste de transação verifica outro usuário
   lendo sempre o conjunto antigo ou o novo.
5. `money.spec.ts` existente continua verde sem alteração de expectativa; novos
   testes afirmam as mensagens com `salaryRangeMinCents` e
   `salaryRangeMaxCents`.
6. `GET /v1/jobs?page=0`, `limit=101`, `sort=title:sideways` e `?status=APPLIED`
   retornam `400`; `page=999` retorna `200` com `data: []` e `totalPages`
   correto.
7. Duas criações concorrentes de `companies` com o mesmo nome para o mesmo
   usuário resultam em exatamente um `201` e um `409`; nenhum `500`.
8. Teste e2e de isolamento: usuário B recebe `404` em `GET/PATCH/DELETE` de
   empresa, recrutador e vaga do usuário A.
9. `npm run lint`, `npm run build`, `npx tsc --noEmit` e a cadeia de migration
   (`migration:revert` → `migration:run` → `schema:log`) validados localmente;
   `npm test` e `npm run test:e2e` seguem pendentes para o humano.

> **Validação desta execução (2026-11-18):** os itens acima descrevem o contrato
> implementado. Nesta execução, `npm run lint` (exit 0, com 1 warning
> preexistente em `test/auth.e2e-spec.ts:232`), `npx tsc --noEmit` e
> `npm run build` terminaram com exit 0. A migration `1794960000000-CreatePipelineDomain`
> foi aplicada, revertida e reaplicada com exit 0; `npm run migration:show`
> mostrou as 3 aplicadas e `schema:log` informou `Your schema is up to date`
> (exit 0), sem drift. Não foram escritos nem executados testes unitários/e2e,
> nem executada a demo manual, por instrução explícita do usuário; testes,
> demo e commit/push/PR/merge/deploy ficam pendentes para o humano. Ver
> `docs/sprints/sprint-03.md`.

## Alternativas consideradas

| Tema | Alternativa | Prós | Contras / por que não |
|---|---|---|---|
| Nullabilidade de `company` | **Relaxar descritivos (escolhida)** | CRUD mínimo com `name` + `kind`; coerente com `profiles` | Depende de aprovação: diverge da leitura literal da spec `:122` |
| Nullabilidade de `company` | Exigir `website`, `industry`, `location`, `notes` | Fiel à lista da spec | Cadastro penoso; nenhuma regra depende desses campos; inconsistente com a Sprint 2 |
| `recruiter.email` | **Opcional (escolhida)** | Cobre recrutador só por LinkedIn; coerente com contatos do perfil | Aprovação necessária: spec `:126` não marca nullable |
| `recruiter.email` | Obrigatório + `UNIQUE(user_id, email)` | Dado sempre disponível para métricas | Constraint nova fora da spec; bloqueia cadastro sem e-mail |
| `job_skill` | **Array embutido + substituição atômica (escolhida)** | Um único contrato de vaga; sem rotas extras; fácil de testar | PATCH maior e com delete+insert; exige transação/lock |
| `job_skill` | CRUD próprio (`POST /v1/jobs/:id/skills`) | granular, PATCH incremental | Fora da spec de API (`:401-403`) e mais uma superfície para manter |
| `job_skill` | Coluna `json` em `jobs` | zero tabela de junção | Perde FK para o catálogo, índice e integridade referencial |
| Dinheiro | **Parâmetro `fieldName` opcional (escolhida)** | Uma implementação; zero quebra em `desiredSalaryCents`; mensagens específicas | Assinatura muda (ainda compatível); todos os call sites precisam ser revisados |
| Dinheiro | Helpers novos só para vaga | Nenhum risco de quebrar perfil | Duplicação de regra de `MAX_SAFE_INTEGER` e de mensagens |
| Dinheiro | Mensagem genérica `cents` | Simples | Perde contexto no `400` de faixa salarial |
| Listagem | **Envelope só em `GET /v1/jobs` (escolhida)** | Fiel à spec e ao ADR de paginação | Companies/recruiters ficam sem envelope; pode ser uniformizado depois |
| Listagem | Envelope em todas as coleções | Uniformidade | Exige quebrar contrato implícito das listas de empresas/recrutadores nesta sprint |
| Filtro `status` | **Rejeitar com `400` (escolhida)** | Sem dado inventado; erro explícito e documentado | Spec `:403` cita o parâmetro — requer confirmação do PO |
| Filtro `status` | Derivar de `application.status` com `EXISTS` | Atende a spec literalmente | Semântica ambígua para vaga sem candidatura; acopla KAN-22 a módulo ainda não implementado |
| Filtro `status` | Adicionar `jobs.status` | Simples de filtrar | Coluna fora do modelo `:129`; duplicaria a máquina de estados de `application` |
| FKs opcionais | **SET NULL (escolhida, com aprovação)** | Preserva vaga/recrutador ao excluir referência opcional | Contraria leitura literal de "todas as FKs CASCADE" do pedido |
| FKs opcionais | CASCADE em todas | Uniforme e atende o pedido literal | Apagar um recrutador apagaria vagas; risco de perda silenciosa (R5) |
| FKs opcionais | `RESTRICT` | Impede perda | Bloqueia exclusão legítima de empresa sem aviso de negócio |

## Spike opcional (30 minutos)

Só se houver dúvida sobre o texto de erro do MySQL 8 antes de fechar a Decisão 7.

1. Aplicar a migration em MySQL local (`docker compose up -d` +
   `npm run migration:run`).
2. Inserir `('Acme', 'CLIENT')` e tentar `('acme', 'CLIENT')` e
   `('Ácme', 'CLIENT')` para o mesmo `userId`.
3. Inserir duas vezes o mesmo par `(job_id, skill_id)` em `job_skills`.
4. Imprimir `driverError.sqlMessage` dos dois erros.

Critério de saída: adotar `isDuplicateEntry(error, 'UQ_companies_user_name')` e
`isDuplicateEntry(error, 'job_skills.PRIMARY')` se os fragmentos aparecerem; caso
o driver omita o prefixo da tabela, manter o fallback `'PRIMARY'` restrito ao
bloco de inserção de `job_skills`. Se `Ácme` **não** colidir com `Acme`, escalar
ao PO antes de prometer unicidade case/accent-insensitive.

## Consequências

### Positivas

- Modelo alinhado à Sprint 2: mesmos helpers, mesmo tratamento de erro, mesma
  convenção de tabelas plurais e `userId` do JWT.
- Vaga é agregado claro: stack viaja no payload, nunca fica órfã por esquecimento
  de uma segunda chamada.
- Faixa salarial com unidade explícita (`currency` + `salaryPeriod`) e conversão
  centralizada; nenhuma quebra no perfil.
- Listagem de vagas previsível, ordenada e com filtros validados.

### Negativas / trade-offs

- Mais campos anuláveis do que a leitura literal da spec (aprovação pendente).
- Substituição de stack faz `DELETE` + `INSERT` a cada PATCH com `skills`; para o
  volume de uma busca pessoal é irrelevante, mas gera mais writes que um diff.
- `q` com `LIKE` não usa índice textual; aceitável para centenas de vagas. Reavaliar
  com FULLTEXT apenas se o volume crescer.
- Acoplamento ao nome das constraints da migration (`UQ_companies_user_name`,
  `job_skills.PRIMARY`), como já acontece na ADR 0002.

### Riscos

- **R1 — `status` sem coluna:** parâmetro da spec sem significado no modelo;
  a rejeição com `400` foi confirmada pelo tech lead e implementada, mas segue
  sujeita à validação humana no portão final (ou à criação de história de filtro
  por candidatura).
- **R2 — `job_skill` sem ID:** não há referência estável para atualizar um único
  vínculo; por isso a substituição é atômica. Qualquer futuro "PATCH de skill"
  exigirá nova decisão.
- **R3 — Duplicidade de nome com normalização/caixa:** a collation ai_ci faz
  `Acme == acme == Ácme`. É o comportamento desejado para evitar duplicatas
  visuais, mas pode surpreender quem queira duas empresas com nomes próximos.
- **R4 — ISO 4217:** validamos apenas `/^[A-Z]{3}$/`, não uma lista fechada de
  códigos. `XYZ` passa. Validar contra catálogo ISO exigiria dependência ou lista
  mantida à mão; fora do escopo, mas registrado.
- **R5 — CASCADE em referências opcionais:** se a validação humana exigir CASCADE
  literal, excluir um recrutador remove vagas; excluir uma empresa-agência remove
  recrutadores. A implementação adotou `SET NULL` nas opcionais e `RESTRICT` em
  `jobs.company_id` (Decisão 10).
- **R6 — Agência sem kind:** `agency_company_id` pode apontar para `CLIENT` ou
  `OTHER`, pois só a ownership foi validada. Checar `kind === AGENCY` é regra nova
  e precisa de história.
- **R7 — Precisão de `bigint`:** acima de `Number.MAX_SAFE_INTEGER` o helper
  falha em vez de arredondar; contrato `number` no JSON precisa ser revisto se
  esse limite for atingido.
- **R8 — Ordenação por `postedAt` nulo:** o default `postedAt:desc` coloca nulos
  por último; se o PO quiser nulos primeiro, é mudança de contrato de ordenação.

## Checklist para o backend-dev

Fechamento local em 2026-11-18 na branch `feat/sprint-2-profile` (uncommitted):

- [x] Criar os 4 enums novos em `src/common/enums/` com imports `.js`.
- [x] Adicionar `fieldName` opcional aos helpers de `money.ts` + specs.
- [x] Criar entidades `Company`, `Recruiter`, `Job`, `JobSkill` (PK composta).
- [x] Criar DTOs de request/response e query DTOs; nenhum com `userId`.
- [x] Implementar `CompaniesService` (UNIQUE, 409, `kind` filter, `RESTRICT` ao excluir com vagas).
- [x] Implementar `RecruitersService` (email normalizado, agência do mesmo usuário).
- [x] Implementar `JobsService` (ownership, salário, skills atômicas, filtros, paginação).
- [x] Usar `ParseUUIDPipe`, `@CurrentUser`, `JwtAuthGuard` e Swagger completo.
- [x] Aplicar a migration `1794960000000-CreatePipelineDomain` sem `synchronize`, validar `revert` → `run` → `schema:log` e conferir as 3 migrations em `migration:show`.
- [x] Rodar `npm run lint`, `npx tsc --noEmit` e `npm run build` (todos exit 0).
- [ ] Testes unitários de helpers e services + e2e de CRUD, isolamento e 409 — pendentes para o humano.
- [ ] Rodar `npm test` e `npm run test:e2e` — pendentes para o humano.

## Aprovação humana pendente no portão final

As quatro confirmações levantadas pelo architect foram **adotadas como decisão de
implementação**, não rejeitadas; todas continuam sujeitas à validação humana na
revisão final:

1. Campos descritivos de `company` anuláveis (Decisão 1) — divergem da leitura
   literal da spec.
2. `recruiter.email` opcional normalizado (Decisão 2) — a spec não marca nullable.
3. `?status=` rejeitado em `GET /v1/jobs` com `400` (Decisão 6) — a spec cita o
   filtro, mas o modelo não tem `job.status`.
4. `description`/`location` de `job` anuláveis (Decisão 3).

Também dependem de validação humana as decisões do tech lead registradas em
"Resolução de conflitos", o `ON DELETE SET NULL` nas FKs opcionais e o
`RESTRICT` em `jobs.company_id` (Decisão 10). Nada foi commitado, enviado ao
remoto, revisado em PR, mesclado ou deployado.

## Referências

- `docs/prompt-kandid.md:119-133` (modelo de pipeline), `:159-176` (enums),
  `:374-431` (API e convenções), `:508-514` (Fase 2).
- `docs/backlog.md:60-62` (KAN-20/21/22).
- `docs/adr/0002-sprint-2-profile.md` (helpers, datas, `ER_DUP_ENTRY`).
- `src/common/utils/money.ts`, `src/common/utils/is-duplicate-entry.ts`,
  `src/common/utils/null-fields.ts`, `src/common/utils/normalize-email.ts`.
- `src/modules/profiles/profiles.service.ts:29-54`, `:160-181`;
  `src/modules/skills/skills.service.ts:136-177`, `:240-242`.
- `src/database/migrations/1794268800000-CreateProfileDomain.ts:14-172`.
