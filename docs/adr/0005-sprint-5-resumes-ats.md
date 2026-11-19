# ADR 0005 — Modelo de dados, contratos e motor ATS da Sprint 5 (currículos e análise determinística)

- Status: Accepted
- Data: 2026-11-18
- Autores: architect (modelo de dados, contratos HTTP, motor ATS e registro); product-owner (histórias KAN-40..43 em `docs/sprints/sprint-05.md`, entregues no follow-up); tech lead (decisões de nomenclatura, FKs, timestamp e reforço das ambiguidades registradas neste ADR)
- Parecer: aprovado com ajustes — decisões adotadas para liberar a implementação. Dois pontos divergem da leitura literal da spec: (1) export JSON/HTML fica na Sprint 6 (E5 do backlog), não nesta; (2) `POST /analyze` **não** atualiza `resume_version.ats_score`, preservando a imutabilidade da versão. Ambos seguem para o portão final humano.
- Decisões do tech lead em follow-up (2026-11-18), incorporadas a este ADR: tabelas físicas sempre no plural (`resumes`, `resume_versions`, `ats_analyses`) com entidades TypeScript no singular mapeadas por `@Entity('...')`; `FK_resume_versions_job` passa a `ON DELETE SET NULL`; `applications.resume_version_id` continua sem FK e sem alteração (ADR 0004 `:98`); `ats_score` permanece `NULL` sem `UPDATE`; timestamp `1795737600000` confirmado sequencial. A descrição conceitual da spec no singular é mantida; apenas o nome físico muda.
- Branch e escopo: `feat/sprint-5-resumes`, base `46f4e8a` (PR #12 mergeado); Sprints 0–4 concluídas; KAN-40..43 (`docs/backlog.md:102-109`), Fase 3 da spec (`docs/prompt-kandid.md:516-524`). Nenhuma alteração em `applications`, `jobs`, `companies`, `profiles` ou em outras tabelas já existentes.
- Regime de validação: `Accepted` aqui significa “decidido para implementar”, não “implementado e validado”. Este ADR não executa comandos, não cria migration, não faz commit/push/PR/merge/deploy e não lê `.env`. Testes, demo, revisão de código e decisão de commit ficam com o humano, conforme `AGENTS.md` e o padrão do ADR 0004 (`:40-43`, `:518-542`).

## Contexto

A Sprint 5 fecha a Fase 3 do produto. Ela transforma o perfil estruturado da Sprint 2 (`profile`, `profile_skill`, `experience`, `experience_bullet`, `education`, `certification`, `language`) em um **snapshot imutável** de currículo e cruza esse snapshot com as vagas e o catálogo de skills da Sprint 3 (`jobs`, `job_skill`, `skills`) por meio de um **motor ATS determinístico**. A Sprint 4 entregou o pipeline de candidaturas e reservou `applications.resume_version_id` como coluna nullable sem FK, com `resumeVersionId: null` no contrato (ADR 0004, decisões 1 e 2). Esta sprint cria a tabela que dará sentido a essa coluna, mas **não a preenche nem a vincula**: associar versão a candidatura é história futura, fora de KAN-40..43.

A imutabilidade é a restrição estrutural central. A spec declara `resume_version` como imutável em `:83` e `:152-154`, e define o snapshot como “imutável, versionado e entrada para ATS e export” em `:306-361`. Isso impede que uma análise altere o currículo que ela analisou: o score precisa viver em `ats_analysis`, uma tabela append-only, e não em um `UPDATE` na versão. A consequência é explicitamente registrada aqui porque a spec, em `:522`, diz que `POST /analyze` “persiste análise e atualiza `ats_score`” — requisito que entra em conflito direto com `:83`/`:152`.

A determinação do motor também é requisito de testabilidade (`:207`): cada etapa é uma função pura, sem I/O, sem relógio de parede e sem acesso a banco. A entrada é sempre o snapshot congelado; “hoje”, quando necessário para experiências `current`, é o `generatedAt` do próprio snapshot, não `Date.now()`. Isso garante que a mesma versão analisada amanhã produza exatamente o mesmo `score`, `breakdown` e `checks`.

Não há dinheiro nesta sprint: nenhuma coluna, DTO ou regra de `currency`/`salary_period`/centavos é introduzida ou alterada. As convenções já aprovadas permanecem: prefixo `/v1`, Swagger em `/docs`, `Authorization: Bearer <jwt>`, `userId` somente do `sub`, `ValidationPipe` com `whitelist`/`forbidNonWhitelisted`/`transform`, erros no formato `{ statusCode, error, message, path, timestamp }`, `synchronize: false`, migrations versionadas, ESM com imports `.js` e TypeScript strict sem `any`.

## Decisão

Adotar o modelo em três tabelas (`resumes`, `resume_versions`, `ats_analyses`), com nomes de FK explícitos, índices compostos sem duplicação, append-only nas duas tabelas de versão/análise, oito rotas pedidas mais o `DELETE` implícito no CRUD (detalhado em Contratos de API) e um motor ATS puro com pesos 35/10/20/15/10/5/5 e renormalização de dimensões não aplicáveis. A geração de versão usa lock pessimista no `resume` e `unique(resume_id, version)`; a análise grava somente `ats_analysis` e **nunca** atualiza `resume_version`.

## Modelo de dados

Migration sugerida: `1795737600000-CreateResumeDomain` (classe `CreateResumeDomain1795737600000`), sequencial após `1795046400000-CreateApplicationsDomain`. O tech lead conferiu a cadeia local e não há conflito de timestamp: as últimas migrations são `1794182400000`, `1794268800000` (`CreateProfileDomain`), `1794960000000` (`CreatePipelineDomain`) e `1795046400000` (`CreateApplicationsDomain`); `1795737600000` é maior que todas elas. **Não criar a migration nesta tarefa**: ela é especificada aqui para o backend-dev. `synchronize: false` permanece.

Padrões aplicados a todas as tabelas: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`; `id varchar(36) NOT NULL PK` com `@PrimaryGeneratedColumn('uuid')` (convenção de `:78` e das migrations anteriores); datas em `datetime(6)`; FKs com nomes idênticos em entidade e migration. A spec descreve os conceitos no singular (`resume`, `resume_version`, `ats_analysis` — `:149`, `:152`, `:156`), e essa **descrição conceitual é mantida**; o **nome físico** segue o padrão plural das migrations anteriores (`users`, `profiles`, `applications` — ADR 0004 `:83-87`) e a regra geral do ADR 0003 (`:19-20`). A única exceção registrada até hoje continua sendo `application_status_history` no singular (ADR 0004 `:53`). Mapeamento obrigatório das entidades TypeScript (singular) para as tabelas (plural), decidido pelo tech lead:

- `Resume` → `@Entity('resumes')`
- `ResumeVersion` → `@Entity('resume_versions')`
- `AtsAnalysis` → `@Entity('ats_analyses')`

Os nomes de FK pedidos — `FK_resumes_user`, `FK_resume_versions_resume`, `FK_resume_versions_job`, `FK_ats_analyses_resume_version`, `FK_ats_analyses_job` — confirmam o plural e devem ser idênticos em entidade e migration, como no ADR 0004 `:83-87`.

**`resumes`** (mutável; única com `updated_at`)

```text
id                 varchar(36) NOT NULL PK
user_id            varchar(36) NOT NULL
name               varchar(120) NOT NULL
target_role        varchar(160) NOT NULL
is_default         tinyint(1) NOT NULL DEFAULT 0
created_at         datetime(6) NOT NULL
updated_at         datetime(6) NOT NULL

UNIQUE INDEX UQ_resumes_user_name (user_id, name)
INDEX IX_resumes_user_created (user_id, created_at, id)
FK resumes.user_id -> users.id ON DELETE CASCADE ON UPDATE NO ACTION
```

- `name` é obrigatório (1..120 caracteres) e único por usuário. `target_role` é `NOT NULL` porque a spec não o marca como nullable (`:150`); quando omitido no POST, recebe `desired_role` do perfil ou `''`. Texto vazio é válido no banco e faz o check `target-role-defined` falhar.
- `is_default` é `tinyint(1)` (boolean do TypeORM). O nome `UQ_resumes_user_name` é o exigido pela decisão; não há índice de unicidade adicional para “default único”, conforme decidido em Resolução de conflitos.
- `IX_resumes_user_created` atende à listagem paginada ordenada por `createdAt DESC, id ASC` dentro do escopo do usuário.

**`resume_versions`** (imutável, append-only)

```text
id                 varchar(36) NOT NULL PK
resume_id          varchar(36) NOT NULL
version            int NOT NULL
job_id             varchar(36) NULL
content_snapshot   json NOT NULL
ats_score          int NULL
created_at         datetime(6) NOT NULL

UNIQUE INDEX UQ_resume_versions_resume_version (resume_id, version)
INDEX IX_resume_versions_job_id (job_id)
FK resume_versions.resume_id -> resumes.id ON DELETE RESTRICT ON UPDATE NO ACTION
FK resume_versions.job_id -> jobs.id ON DELETE SET NULL ON UPDATE NO ACTION
```

- Colunas exatamente as da spec `:153`; `uuid` vira `varchar(36)` para casar com as PKs. `version` começa em 1 e incrementa por `resume`. `job_id` é nullable: uma versão pode ser gerada sem vaga específica. `content_snapshot` é o JSON imutável descrito em `:306-357`.
- `ats_score` existe porque a spec o lista, mas fica **sempre `NULL` nesta sprint** (exceção documentada abaixo). Nenhum `UPDATE` escreve nessa coluna.
- Ações de FK decididas pelo tech lead: `FK_resume_versions_resume` usa **`RESTRICT`** — apagar um `resume` com versões apagaria snapshots imutáveis; o service devolve `409` antes do banco e o banco é a última linha de defesa. `FK_resume_versions_job` usa **`SET NULL`**: `job_id` é nullable e nenhuma rota da Sprint 5 preenche ou altera esse campo em uma versão já gravada (`POST /analyze` nunca toca a versão — decisões 10/11), então não há motivo para bloquear a exclusão da vaga; o `SET NULL` é feito pelo banco sem `UPDATE` de domínio e a versão sobrevive com `job_id = null`. Ver nota de portão humano sobre a leitura literal de “nenhuma rota preenche”.

**`ats_analyses`** (imutável, append-only)

```text
id                 varchar(36) NOT NULL PK
resume_version_id  varchar(36) NOT NULL
job_id             varchar(36) NOT NULL
score              int NOT NULL
breakdown          json NOT NULL
checks             json NOT NULL
matched_keywords   json NOT NULL
missing_keywords   json NOT NULL
created_at         datetime(6) NOT NULL

INDEX IX_ats_analyses_version_created (resume_version_id, created_at, id)
INDEX IX_ats_analyses_job_created (job_id, created_at, id)
FK ats_analyses.resume_version_id -> resume_versions.id ON DELETE CASCADE ON UPDATE NO ACTION
FK ats_analyses.job_id -> jobs.id ON DELETE RESTRICT ON UPDATE NO ACTION
```

- Colunas exatamente as da spec `:157`. `score` é o inteiro 0..100 calculado pelo motor; os quatro JSON são não nulos mesmo quando vazios (`[]`).
- `CASCADE` em `resume_version_id` acompanha a propriedade da versão (a análise não vive sem ela); como não existe rota de exclusão de versão, esse cascade não é caminho de uso normal. `RESTRICT` em `job_id` preserva a vaga analisada.

**Índices e não redundância (critério verificável).** Não criar `IX_resumes_user`, `IX_resume_versions_resume_id`, `IX_ats_analyses_resume_version`, `IX_ats_analyses_job_id` nem `IX_ats_analyses_created_at`:

- `UQ_resumes_user_name (user_id, name)` já indexa o prefixo `user_id`;
- `UQ_resume_versions_resume_version (resume_id, version)` já indexa o prefixo `resume_id`;
- `IX_ats_analyses_version_created` já indexa o prefixo `resume_version_id` (necessário para a FK e para `ORDER BY created_at DESC, id ASC` na leitura da última análise);
- `IX_ats_analyses_job_created` já indexa o prefixo `job_id` (necessário para a FK e para consultas futuras por vaga);
- `created_at` nunca é filtrado sozinho em nenhuma rota desta sprint; criar `IX_ats_analyses_created_at` ou `IX_resume_versions_created_at` seria índice não usado em tabela append-only, com custo de escrita sem benefício de leitura.

Critério de aceite: `SHOW INDEX` nas três tabelas e `npm run typeorm -- schema:log -d src/database/data-source.ts` sem drift e sem índice duplicado. A duplicata mais provável, `IX_resumes_user` ao lado de `UQ_resumes_user_name`, deve ser considerada defeito de migration.

### Imutabilidade

1. `resume_versions` é **append-only**: sem `UPDATE`, sem `DELETE`, sem `PATCH /v1/resume-versions/:id`, sem `updated_at`. Uma correção de conteúdo gera uma nova versão com `version + 1`.
2. `content_snapshot` é gravado na criação da versão e nunca alterado, nem por mudança no perfil, nem por análise, nem por export.
3. `ats_analyses` é **append-only**: reanalisar a mesma versão/vaga insere uma nova linha; sem `UPDATE`, sem `DELETE`, sem `updated_at`.
4. **Exceção documentada — `ats_score`:** a coluna existe na tabela por fidelidade à spec `:153`, é nullable, é inserida como `NULL` e permanece `NULL` para sempre nesta sprint. O score de uma análise é lido de `ats_analyses.score` (rota `GET .../analysis`; no futuro, também nos metadados de export). Isso resolve o conflito com `:522` sem quebrar `:83`. Se o humano decidir que a spec `:522` é obrigatória, será necessário revertê-la formalmente neste ADR **e** aceitar que `resume_version` deixa de ser imutável — não é uma mudança silenciosa de service.

## Contratos de API

Prefixo global `/v1`, Swagger em `/docs`, `Authorization: Bearer <jwt>` obrigatório (sem header → `401`). `userId` sempre do JWT; nenhum DTO de request/query declara `userId`, `user_id` ou `resumeId` quando o recurso já vem do path. Recurso de outro usuário → `404`, sem revelar existência. Qualquer UUID fora do formato → `400`. Erros seguem o formato único do projeto.

**Contagem de rotas.** A solicitação menciona “8 rotas”. No padrão do ADR 0003 (`:269-273`), `CRUD /v1/resumes` são cinco endpoints (criar, listar, ler, atualizar, excluir); somados aos quatro de versão/analyze previstos na spec `:415-417`, totalizam **nove**. Para não omitir contrato previsto na spec, todos os nove estão listados. Se o humano confirmar que `DELETE /v1/resumes/:id` não entra no MVP, ele sai por ajuste registrado neste ADR — não por omissão silenciosa. **Não há nenhuma rota de export** (`/export?format=json|html` fica para a Sprint 6, KAN-50/KAN-51).

| Método | Rota | Request | Sucesso | Erros principais |
|---|---|---|---|---|
| POST | `/v1/resumes` | `CreateResumeDto` | `201` + `ResumeResponseDto` | `400`, `401`, `409` (`UQ_resumes_user_name`) |
| GET | `/v1/resumes` | Query: `page`, `limit` | `200` + `{ data, meta }` | `400` (inclusive `sort`), `401` |
| GET | `/v1/resumes/:id` | — | `200` + `ResumeResponseDto` | `400` (UUID), `401`, `404` |
| PATCH | `/v1/resumes/:id` | `UpdateResumeDto` | `200` + `ResumeResponseDto` | `400`, `401`, `404`, `409` |
| DELETE | `/v1/resumes/:id` | — | `204` sem body | `400`, `401`, `404`, `409` (versões vinculadas) |
| POST | `/v1/resumes/:id/versions` | `CreateResumeVersionDto` | `201` + `ResumeVersionResponseDto` | `400`, `401`, `404` (resume/job), `409` (duplicata de versão) |
| GET | `/v1/resume-versions/:id` | — | `200` + `ResumeVersionResponseDto` | `400` (UUID), `401`, `404` |
| POST | `/v1/resume-versions/:id/analyze` | `AnalyzeResumeVersionDto` | `201` + `AtsAnalysisResponseDto` | `400`, `401`, `404` (versão/job) |
| GET | `/v1/resume-versions/:id/analysis` | — | `200` + `AtsAnalysisResponseDto` (última análise) | `400` (UUID), `401`, `404` (sem análise) |

Não existem `DELETE /v1/resume-versions/:id`, `PATCH /v1/resume-versions/:id`, rota de listagem de versões, rota de listagem de análises nem qualquer `POST/GET .../export` nesta sprint.

**DTOs e formatos**

- `CreateResumeDto`: `name` obrigatório (1..120), `targetRole?` (≤ 160), `isDefault?` boolean. Rejeitar com `400`: `userId`, `user_id`, `id`, `createdAt`, `updatedAt`, `versions` e qualquer campo fora da whitelist. Primeiro currículo do usuário vira default automaticamente; os demais só viram default com `isDefault: true` (decisão provisória).
- `UpdateResumeDto`: subconjunto de `name`, `targetRole`, `isDefault`, com `hasField` para distinguir ausente de `null`. `null` em qualquer um dos três → `400`; `targetRole: ''` é aceito e representa “não definido” para o check `target-role-defined`. Renomear para nome já usado → `409`. `isDefault: false` apenas limpa o flag (o usuário pode ficar sem default; ver portão humano).
- `ResumeResponseDto`: `id`, `userId` (somente leitura, igual ao `sub`), `name`, `targetRole`, `isDefault`, `createdAt`, `updatedAt`. `userId` aparece na resposta pelo mesmo critério do ADR 0004 (decisão 17); nunca em request/query.
- `QueryResumeDto`: somente `page` e `limit`; `page` default `1`, `limit` default `20` e `1 <= limit <= 100`. `?sort=` e qualquer parâmetro fora da whitelist → `400` com `Unsupported query parameters: sort. Supported: page, limit`, seguindo o padrão do ADR 0004. Envelope `{ data, meta: { page, limit, total, totalPages } }`, `totalPages = Math.ceil(total / limit)` e `0` quando vazio; página além do fim → `200` com `data: []`. Ordem fixa `createdAt DESC, id ASC`. Lista paginada aqui diverge de `GET /v1/companies` (array simples no ADR 0003 `:239`), porque a convenção global de paginação da spec `:430` e a necessidade de `{ data, meta }` foram adotadas para este recurso.
- `CreateResumeVersionDto`: `jobId?` UUID. Rejeitar `resumeId`, `userId`, `user_id`, `version`, `contentSnapshot`, `atsScore`, `createdAt` e campos fora da whitelist. `jobId` informado deve pertencer ao usuário; vaga alheia ou inexistente → `404`. Omitido → `jobId: null` na versão.
- `ResumeVersionResponseDto`: `id`, `resumeId`, `version`, `jobId`, `contentSnapshot` (objeto JSON), `atsScore` (**sempre `null` nesta sprint**), `createdAt`. Sem `updatedAt`.
- `AnalyzeResumeVersionDto`: `jobId` obrigatório e UUID. Rejeitar `resumeVersionId`, `resumeId`, `userId`, `score`, `breakdown`, `checks`, `matchedKeywords`, `missingKeywords` e campos fora da whitelist. Vaga alheia/inexistente → `404`; se `resume_version.job_id` não for nulo e divergir do `jobId` enviado → `400`. A versão não é alterada em nenhum dos casos.
- `AtsAnalysisResponseDto`: `id`, `resumeVersionId`, `jobId`, `score`, `breakdown`, `checks`, `matchedKeywords`, `missingKeywords`, `createdAt` (ISO 8601 UTC). `breakdown` e `checks` seguem o formato de `:268-289`.
- `GET .../analysis` devolve a **última** análise da versão, ordenada por `createdAt DESC, id ASC`. Sem análise → `404`. Levantar histórico completo de análises exigiria nova rota (por exemplo `/analyses`), fora de KAN-40..43.

Exemplos de erro (formato único):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Resume name already exists for this user",
  "path": "/v1/resumes",
  "timestamp": "2026-11-18T12:00:00.000Z"
}
```

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Job not found",
  "path": "/v1/resumes/7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d/versions",
  "timestamp": "2026-11-18T12:05:00.000Z"
}
```

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "jobId does not match the job of this resume version",
  "path": "/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analyze",
  "timestamp": "2026-11-18T12:10:00.000Z"
}
```

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "No analysis found for this resume version",
  "path": "/v1/resume-versions/2b3c4d5e-6f70-4819-9a2b-3c4d5e6f7081/analysis",
  "timestamp": "2026-11-18T12:15:00.000Z"
}
```

## Motor ATS

Implementação em `src/modules/ats/engine/`, uma responsabilidade por arquivo, todas as funções puras: sem banco, sem I/O, sem relógio de parede, sem `Math.random()` e sem `any`. A entrada canônica é o `ResumeSnapshot` gravado em `resume_versions.content_snapshot`; “hoje” é `snapshot.generatedAt` (ISO 8601 UTC). Tipos são descritivos (documentação, não código de produção):

```ts
interface SkillCatalogEntry {
  id: string;
  name: string;
  aliases: readonly string[];
}

interface SkillMatch {
  skillId: string;
  name: string;
  matchedAs: string;
  weight: number;
}

interface JobRequirement {
  required: SkillMatch[];
  niceToHave: SkillMatch[];
  yearsRequired: number | null;
  seniorityHint: Seniority | null;
  educationRequired: boolean;
  certificationRequired: boolean;
  languagesRequired: readonly string[];
}

interface WeightedSection {
  section: 'summary' | 'recentHighlight' | 'otherHighlight' | 'skills' | 'projects';
  weight: number;
  text: string;
}

interface StructuralCheck {
  id: string;
  passed: boolean;
  detail: string | null;
}

interface ScoreDimension {
  dimension: string;
  weight: number;
  effectiveWeight: number;
  earned: number | null;
  applicable: boolean;
  matched: string[];
  missing: string[];
  detail: string | null;
}

interface AtsScoreResult {
  score: number;
  breakdown: ScoreDimension[];
  matchedKeywords: string[];
  missingKeywords: string[];
}
```

**`normalizer.ts` — `normalize(input: string): string`**
Aplica, nesta ordem: lowercase; remoção de acentos (NFD + remoção de marcas diacríticas); colapso de espaços; canonicalização antes de tokenizar (`c++ → cpp`, `c# → csharp`, `.net → dotnet`, `node.js → nodejs`, `ci/cd → cicd`); preservação de dígitos relevantes (anos de experiência). A mesma função é usada para descripción da vaga, aliases do catálogo e texto do snapshot, garantindo que a comparação seja simétrica.

**`job-parser.ts` — `parseJob(input: { description: string; skills: readonly SkillCatalogEntry[] }): JobRequirement`**
Divide em blocos e detecta seções por títulos: obrigatórias (`requisitos`, `requirements`, `must have`, `obrigatório`, `necessário`) e desejáveis (`diferenciais`, `nice to have`, `desejável`, `plus`, `preferencial`). Sem seção reconhecida, todos os matches entram em `required`. Faz matching contra `skill.name` + `skill.aliases`, com aliases ordenados por tamanho decrescente para evitar match parcial, e deduplica por `skill_id`. Extrai anos com `(\d+)\s*\+?\s*(anos|years)`; havendo mais de um número, usa o **maior** (decisão provisória, registrada no portão humano). `seniorityHint` vem da menção explícita a um membro de `Seniority` (spec `:162`), na ordem `INTERN..PRINCIPAL`. Detectores provisórios e determinísticos de formação/certificação e idiomas são necessários para as dimensões de 10 e 5 pontos; a spec não fornece o dicionário, então ele fica registrado como ambiguidade e sujeito ao portão humano.

**`resume-extractor.ts` — `extractResume(snapshot: ResumeSnapshot): WeightedSection[]`**
Pesos exatos da spec `:235-245`: `summary` = 2; highlights das **2 experiências mais recentes** = 3; demais highlights = 1; `skills` = 2; `projects` = 1. Ordem determinística das experiências: `current = true` primeiro, depois `startDate DESC`, depois `sortOrder ASC`, depois `id ASC` (critério de desempate provisório). Uma keyword está presente se aparecer em qualquer seção com peso ≥ 1. O peso do match é o **maior** peso entre as seções onde ele aparece — somar pesos de seções diferentes contaria duas vezes a mesma skill.

**`checks.ts` — `runChecks(snapshot: ResumeSnapshot): StructuralCheck[]`**
Avalia o snapshot, não HTML, e devolve exatamente estes IDs, nesta ordem: `has-summary`, `has-contact` (e-mail **e** telefone), `has-experience`, `has-highlights`, `dates-consistent` (toda experiência tem `startDate`; `current = true` não tem `endDate`), `no-empty-required-sections`, `bullet-length` (≤ 220 caracteres por bullet), `has-skills`, `target-role-defined`, `no-duplicate-skills`. `detail` é `null` quando `passed = true` e uma explicação curta quando `passed = false`.

**`scorer.ts` — `score(input: { job: JobRequirement; sections: readonly WeightedSection[]; checks: readonly StructuralCheck[]; snapshot: ResumeSnapshot }): AtsScoreResult`**

| Dimensão | Peso | Cálculo |
|---|---|---|
| `requiredSkills` | 35 | `35 * (peso dos matches obrigatórios / peso total obrigatório)` |
| `niceToHaveSkills` | 10 | `10 * (peso dos matches desejáveis / peso total desejável)` |
| `seniority` | 20 | igual = 100; diferença de 1 nível = 60; diferença ≥ 2 = 0 |
| `yearsExperience` | 15 | `min(100, anosReais / anosExigidos * 100)` |
| `educationCertification` | 10 | requisito detectado e atendido = 100; detectado e não atendido = 0 |
| `languages` | 5 | requisito detectado e atendido = 100; detectado e não atendido = 0 |
| `resumeStructure` | 5 | `100 * (checks aprovados / 10)` |

Renormalização: seja `A` o conjunto de dimensões aplicáveis e `W = Σ peso(d)` para `d ∈ A`. Para cada `d ∈ A`, `effectiveWeight = peso(d) / W`; dimensões não aplicáveis ficam com `applicable: false`, `earned: null` e são excluídas de `W`. O score é `round(Σ effectiveWeight(d) * earned(d))`, com clamp final em `[0, 100]`. `earned` por dimensão também é inteiro arredondado. `breakdown` mantém `weight` com o peso original da spec (35/10/20/15/10/5/5) e expõe `effectiveWeight` para explicar a renormalização; `detail` descreve a contagem (ex.: `2 de 3 skills obrigatórias encontradas`). `matchedKeywords` = união deduplicada de skills encontradas nas duas listas, na ordem em que aparecem; `missingKeywords` = somente skills obrigatórias não encontradas.

**Anos, skill years e reprodutibilidade.** `profile_skill.years_experience` (spec `:100`) vira `skills[].years` no snapshot (número com uma casa decimal, ou `null` se ausente) e é **informativo**: não entra em `anosReais`, porque a spec `:261` define anos reais como a soma das durações das experiências. Cada duração é calculada em meses com limites inclusivos, usando `YYYY-MM`; `current = true` usa `snapshot.generatedAt` como fim e ignora `endDate`; `start > end` contribui com zero e reprova `dates-consistent`. Períodos sobrepostos são somados, conforme a leitura literal de “soma das durações” — registrado como ambiguidade. Se a vaga não informa anos (`yearsRequired = null`), a dimensão é `notApplicable`; se informa e o currículo não tem experiências dated, a dimensão é aplicável com `anosReais = 0` (nota 0), não `notApplicable`.

## Resolução de conflitos

Decisões adotadas para destravar KAN-40..43. `docs/sprints/sprint-05.md` **já foi escrito pelo product-owner**; o architect **não o editou**, e a mistura de nomenclatura (`resumes` no plural versus `resume_version`/`ats_analysis` no singular) foi **resolvida pelo tech lead** com a decisão de tabelas físicas plurais registrada neste ADR. Onde houver divergência de redação entre spec, backlog, `sprint-05.md` e este ADR, prevalece esta tabela até o portão humano.

| # | Tema | Fontes em conflito | Decisão adotada | Justificativa verificável |
|---|---|---|---|---|
| 1 | Export na Sprint 5 | Spec `:363-372,:521,:524` inclui JSON/HTML; backlog `:111-116` coloca KAN-50/KAN-51 na Sprint 6 | **Sem rotas de export nesta sprint**; Fase 3 da spec fica parcialmente adiada | Escopo do backlog é mais recente; export depende só do snapshot, pode ser entregue depois sem mudar schema. Nenhum `?format=` é aceito |
| 2 | `applications` | Spec `:522` e Fase 2 sugerem vincular versão à candidatura; ADR 0004 `:98` reservou `resume_version_id` “**SEM FK até a Sprint 5**” (reforçado em `:124-125,:527`) | **Decisão provisória reforçada pelo tech lead: a Sprint 5 NÃO cria essa FK e não altera `applications`**; coluna segue `null`, sem FK, sem backfill e sem `resumeVersionId` em request/query | KAN-40..43 não cobrem associação; evita dívida de integridade e quebra do contrato `null` aprovado na Sprint 4. Ambiguidade de portão humano: a frase do ADR 0004 pode ser lida como promessa de FK nesta sprint, mas o escopo aprovado prevalece; se o humano quiser criar a FK, vira nova história + migration |
| 3 | Resposta de `GET .../analysis` | Spec `:417` lista a rota, mas não define request/saída | **Última análise** por `createdAt DESC, id ASC`, `200` + um DTO; sem análise → `404` | Nome no singular; histórico completo exigiria nova rota. Critério: duas análises geradas, a segunda é devolvida |
| 4 | Numeração de versão | Spec `:154,:360` diz “incrementa `version`”, sem ponto de partida | **Começa em 1**; próxima = `MAX(version) + 1` dentro do lock | Verifyável por `version = 1` na primeira criação e `2` na segunda; evita versão `0` no contrato |
| 5 | Default único | Spec `:150` diz `is_default boolean`, sem regra de unicidade | **No máximo um default por usuário**, garantido no service com lock determinístico na linha de `users` antes de POST/PATCH/DELETE que altere o flag; nenhuma coluna/índice novo | Mantém “colunas exatas da spec”. Critério: duas requisições concorrentes → uma espera e uma única linha com `is_default = 1`. Alternativa de generated column fica para o humano |
| 6 | Primeiro currículo | Spec omissa | **Primeiro currículo do usuário vira default** mesmo que `isDefault` venha `false` | Garante que exista um alvo natural para geração de versão; `isDefault: true` passa a ser necessário para trocar depois |
| 7 | Limpar o default | Spec omissa | **`isDefault: false` no default atual é permitido**; usuário pode ficar sem default | Invariante é “no máximo um”, não “pelo menos um”; regra “pelo menos um” seria inventada |
| 8 | Múltiplas analyses | Spec `:156-157` não tem unique em `(resume_version_id, job_id)`; Fase 3 fala em análise | **Permitidas** múltiplas analyses para a mesma versão e vaga; tabela append-only, sem upsert | `created_at` e `id` distinguem execuções; histórico de score é útil e não exige coluna nova |
| 9 | Nomes de tabelas e FKs | Spec usa singular (`:149,:152,:156`); `sprint-05.md` mistura `resumes` com `resume_version`/`ats_analysis`; tech lead decidiu padronizar | **Descrição conceitual da spec mantida no singular; nome físico das tabelas no plural:** `resumes`, `resume_versions`, `ats_analyses`, com `Resume` → `@Entity('resumes')`, `ResumeVersion` → `@Entity('resume_versions')`, `AtsAnalysis` → `@Entity('ats_analyses')`, e FKs `FK_resumes_user`, `FK_resume_versions_resume`, `FK_resume_versions_job` (`SET NULL`), `FK_ats_analyses_resume_version`, `FK_ats_analyses_job` | Padrão físico das migrations anteriores (`users`, `profiles`, `applications` — ADR 0004 `:83-87`) e nomes de FK pedidos já pressupõem plural; exceção de `application_status_history` continua isolada no ADR 0004 `:53` |
| 10 | Imutabilidade | Spec `:83,:152,:361` vs `:522` (“atualiza `ats_score`”) | **Versão, snapshot e análise append-only**; nenhum `UPDATE`, nenhum `DELETE` de versão | Critério: nenhum `UPDATE resume_versions` no código e nenhuma rota de alteração de versão; score lido de `ats_analysis` |
| 11 | `ats_score` | Spec `:153` prevê coluna; `:522` pede atualização; tech lead reforçou a decisão | **Coluna mantida, nullable, sempre `NULL` nesta sprint; nenhum `UPDATE` em `resume_versions`; score servido por `ats_analysis.score`** | Preserva imutabilidade; qualquer preenchimento futuro exige decisão humana formal e revisão da regra de append-only |
| 12 | `updated_at` em imutáveis | Convenção `:79` sugere `created_at`/`updated_at` em toda entidade | **`updated_at` somente em `resumes`**; ausente em `resume_versions` e `ats_analyses` | Campo que nunca muda é contradição com append-only; mesmo padrão de `application_status_history` no ADR 0004 `:141` |
| 13 | `DELETE /resume-versions/:id` | “CRUD” implícito vs imutabilidade | **Não existe**; correção gera nova versão | Preserva snapshot e rastro da análise |
| 14 | `jobId` ao criar versão | Spec `:153` marca `job_id` como nullable, sem regra de posse | **Opcional**; se informado, precisa ser uma vaga do usuário; alheia/inexistente → `404` | Mesma regra de ownership do ADR 0004 decisão 13; `404` não revela existência |
| 15 | `jobId` ao analisar | Spec `:417` não define body | **Obrigatório no body**; vaga do usuário; se a versão já tem `job_id` diferente → `400`; versão com `job_id = null` aceita qualquer vaga própria | A rota não tem `:jobId` no path; não mutar a versão evita quebrar imutabilidade |
| 16 | Exclusão de `resume` com versões | Spec `:414` diz CRUD, sem regra de dependência | **`RESTRICT` + `409` no service** quando há versões; sucesso `204` quando não há | Apagar versão apagaria snapshot imutável e análises; coerente com `RESTRICT` de `jobs` no ADR 0004 |
| 17 | Paginação de `GET /resumes` | ADR 0003 `:239` devolve array para empresas; spec `:430` prevê `{ data, meta }` | **Envelope `{ data, meta }`**, `page`/`limit`, ordem fixa, `?sort=` → `400` | Convenção global da spec e consistência com a listagem de candidaturas; `sort` segue o padrão já rejeitado no ADR 0004 |
| 18 | Contagem de rotas | Solicitação fala em 8; `CRUD` no ADR 0003 `:269-273` são 5 | **Nove endpoints listados**: cinco de `resumes` + quatro de versão/analyze | Não omitir `DELETE /v1/resumes/:id` previsto na spec `:414`; confirmação final humana |
| 19 | Anos reais | Spec `:261` diz somar durações e usar `is_current` até hoje | **`generatedAt` do snapshot como “hoje”**, meses inclusivos, sobreposições somadas, skill years não usados | Determinístico: reanalisar o mesmo snapshot reproduz o mesmo score. Ambiguidades de sobreposição e arredondamento vão ao portão |
| 20 | Senioridade no snapshot | Spec `:255` exige dimensão; contrato de snapshot `:310-357` não tem campo de senioridade | **Extensão provisória `seniority` no snapshot**, copiada de `profile.desired_seniority` na geração; ausente → dimensão `notApplicable` | Sem isso a dimensão de 20 pontos seria sempre inaplicável; extensão é registrada e sujeita ao portão humano |
| 21 | Escopo por usuário em análise | Spec `:82,:429` exige escopo; `ats_analysis` não tem `user_id` | **Ownership por join**: `resume_versions → resumes.user_id`; análise nunca aceita `userId` | Evita coluna fora da spec; recurso alheio → `404` |
| 22 | Hash/ordem dos checks | Spec `:291-304` lista IDs, não ordem nem `detail` | **Ordem da spec e `detail = null` quando passa** | Saída estável para fixtures e diff de breakdown |
| 23 | Ação da FK `resume_versions.job_id` | Proposta do architect era `RESTRICT` (coerente com `applications.job_id`); tech lead decidiu `SET NULL` | **`FK_resume_versions_job ... ON DELETE SET NULL ON UPDATE NO ACTION`**; `job_id` é nullable e nenhuma rota da Sprint 5 altera/preenche essa coluna em versão gravada; `POST /analyze` nunca a modifica | `SET NULL` mantém a versão e o snapshot após exclusão da vaga sem exigir `UPDATE` em tabela imutável; critério: `DELETE` de vaga referenciada zera `job_id` e não remove a versão nem as análises |
| 24 | Timestamp da migration | Cadeia local existente `1794182400000`, `1794268800000`, `1794960000000`, `1795046400000` | **`1795737600000-CreateResumeDomain`**, sequencial, sem conflito (tech lead conferiu) | Ordem crescente verificada por `migration:show`; nenhuma renumeração de migration anterior |

## Estratégia de transação

**Geração de versão (KAN-40).** Em uma única transação: (1) localizar `resumes` por `id` **e** `userId` com `pessimistic_write`; ausência → `404`; (2) se `jobId` foi informado, validar posse da vaga (`jobs` por `id` e `userId`), alheia/inexistente → `404`; (3) ler perfil e entidades filhas e construir o snapshot com `schemaVersion: "1.0"` e `generatedAt` em UTC; (4) calcular `nextVersion = MAX(version) + 1` innerhalb do lock, com `1` quando não houver versões; (5) inserir em `resume_versions` com `ats_score = NULL`. O lock no `resume` serializa todas as versões daquele currículo; duas requisições concorrentes produzem as versões 1 e 2, nunca duas versões 1. A `unique(resume_id, version)` (`UQ_resume_versions_resume_version`) é a última linha de defesa: `ER_DUP_ENTRY` traduzido por `isDuplicateEntry(error, 'UQ_resume_versions_resume_version')` dispara **uma** repetição da leitura de `MAX` sob o mesmo lock; se ainda duplicar, retorna `409 Version already generated`. Outros `QueryFailedError` permanecem `500` sem vazar SQL, conforme o filtro global. Se falhar qualquer escrita, nada é gravado.

**Default único.** Antes de POST/PATCH/DELETE que possa mudar `is_default`, adquirir `pessimistic_write` na linha de `users` do `sub` (mesmo `id` da FK `FK_resumes_user`) e, dentro da transação, limpar `is_default` dos outros currículos do usuário antes de definir o novo. Ordem fixa de lock evita deadlock entre duas requisições do mesmo usuário; a segunda vê o estado já commitado. Nenhuma coluna ou índice é acrescentado a `resumes` para isso. Critério: teste concorrente com dois POSTs `isDefault: true` deixa exatamente um `is_default = 1`.

**Análise (KAN-41 a KAN-43).** A computação das funções puras acontece fora da transação, a partir de dados já carregados: snapshot da versão, `job.description` e catálogo de `skills`. Dentro de uma única transação: (1) carregar a versão com join em `resumes` por `id` e `userId` → `404` se alheia/inexistente; (2) carregar a vaga por `id` e `userId` → `404`; (3) se `resume_version.job_id` não for nulo, exigir igualdade com o `jobId` enviado → `400` caso contrário; (4) inserir **somente** uma linha em `ats_analyses` com `score`, `breakdown`, `checks`, `matched_keywords`, `missing_keywords` e `created_at`; (5) commit. **Não há `UPDATE resume_versions` e não há preenchimento de `ats_score`** (decisão 10/11). O `score` consumido pela API é `ats_analyses.score`, devolvido por `GET /v1/resume-versions/:id/analysis` e, na Sprint 6, nos metadados de export. Reanalisar cria outra linha; não há upsert nem exclusão da anterior.

**Leitura da última análise.** `ORDER BY created_at DESC, id ASC LIMIT 1` usando `IX_ats_analyses_version_created`; empate de timestamp é resolvido pelo `id`. O índice composto cobre filtro e ordenação sem `filesort` para o caso comum.

## Alternativas consideradas

| Tema | Alternativa | Prós | Contras / por que não |
|---|---|---|---|
| Score na versão | **Gravar só em `ats_analyses` (escolhida)** | Preserva `:83`/`:152`; histórico de scores; sem `UPDATE` em tabela imutável | Contraria a frase “atualiza `ats_score`” de `:522`; exige leitura adicional na API/export |
| Score na versão | Atualizar `resume_version.ats_score` na análise | Casa com `:522`; um campo só na resposta da versão | Quebra imutabilidade e torna o snapshot dependente do momento da análise; rejeitado |
| Score na versão | Coluna nullable preenchida na criação da versão e mantida `null` | Nunca atualiza | Não entrega score algum nesta sprint e deixa a coluna enganosa; opção (a) registrada e preterida pela (b) |
| Export | **Sprint 6 / E5 (escolhida)** | Foco em KAN-40..43; snapshot já guardado para export futuro | Fase 3 da spec fica incompleta até a Sprint 6 |
| Export | Implementar JSON/HTML agora | Fecha Fase 3 literalmente | Duplica escopo do backlog e adiciona requisitos de XSS/CSS sem história aprovada |
| `resume_version_id` em `applications` | **Manter `null`, sem FK (escolhida)** | Contrato estável da Sprint 4; sem mudança em migração anterior | Associação útil fica para história futura |
| `resume_version_id` em `applications` | Criar FK e backfill agora | Relacionamento completo | Fora de KAN-40..43; `null` viraria dado inválido em linhas existentes |
| Nome da tabela | **Plural no físico + singular na entidade (escolhida)** | Coerente com `users`/`profiles`/`applications` (ADR 0004 `:83-87`), com os nomes de FK pedidos e com a descrição conceitual da spec | Exige `@Entity('resumes')` etc. explícitos; divergência textual da spec no singular |
| Nome da tabela | Singular como a spec | Fidelidade literal | Nomes de FK pedidos virariam `FK_resume_user` etc.; exceção de `application_status_history` é a única registrada |
| Default único | **Lock na linha de `users` (escolhida)** | Sem coluna nova; serializa por usuário; verificável | Lock mais amplo que o necessário; aceitável em volume pessoal |
| Default único | Generated column + unique index | Integridade no banco | Acrescenta coluna não prevista na spec; viola “colunas exatas” |
| Exclusão de `resume` | **`RESTRICT` + `409` (escolhida)** | Preserva snapshots e análises | Usuário precisa trocar de default/criar outro antes de apagar |
| Exclusão de `resume` | `CASCADE` | Limpeza simples | Apagaria dados imutáveis e a auditoria de score |
| FK `resume_versions.job_id` | **`SET NULL` (escolhida pelo tech lead)** | `job_id` é nullable; versão e snapshot sobrevivem à exclusão da vaga sem `UPDATE` de domínio | Perde-se o vínculo com a vaga na versão; a análise em `ats_analyses.job_id` permanece com `RESTRICT` e preserva a origem do score |
| FK `resume_versions.job_id` | `RESTRICT` (proposta original do architect) | Preservaria o vínculo com a vaga | Bloquearia `DELETE /v1/jobs/:id` por causa de uma versão que nem chegou a ser vinculada a análise; contrariado pelo tech lead |
| Índices | **Compostos com prefixo de FK (escolhida)** | Uma estrutura atende FK + consulta + ordenação | Nomes de índice por FK “puros” não existem; documentado |
| Índices | Índice separado por coluna | Nomes óbvios | Duplicação de prefixo; `SHOW INDEX`/`schema:log` acusaria redundancy |
| `GET .../analysis` | **Última análise (escolhida)** | Contrato simples, nome no singular | Não expõe evolução do score; nova rota se precisar |
| `GET .../analysis` | Array de todas | Histórico completo | Envelope não especificado; ordenação e paginação inventadas |
| Anos reais | **`generatedAt` do snapshot (escolhida)** | Reprodutível; ausência de relógio de parede não altera o score | “Até hoje” da spec passa a ser o hoje da geração, não o da análise |
| Anos reais | `Date.now()` na análise | Interpretação literal de “até hoje” | Motor deixa de ser determinístico; quebra requisito de `:207` |
| Skill years | **Informativo no snapshot (escolhida)** | Fiel a `:261`; evita dupla contagem com experiências | Skill sem experiência datada não pontua na dimensão de anos |

## Consequências

### Positivas

- Modelo alinhado às colunas da spec, com nomes de tabela/FK padronizados e nenhuma coluna inventada.
- Imutabilidade de `resume_version`, snapshot e `ats_analysis` é preservada por schema, ausência de `updated_at`, ausência de rotas de alteração e ausência de `UPDATE`.
- Motor ATS é reproduzível por fixtures: mesmo snapshot + mesma vaga + mesmo catálogo → mesmo resultado, independentemente da data da execução.
- Concorrência de geração de versão tem critério simples de verificação (versões 1 e 2, sem `500`) e `UNIQUE` violada é traduzida somente pelo fragmento conhecido.
- Nenhuma mudança em tabelas já migradas; cadeia confirmada pelo tech lead: `1794182400000` → `1794268800000` → `1794960000000` → `1795046400000` → `1795737600000`, sem conflito de timestamp.

### Negativas / trade-offs

- `resume_version.ats_score` fica sempre `NULL`; a spec `:522` não é atendida literalmente.
- `GET .../analysis` expõe só a última análise; o histórico existe no banco, mas não tem rota nesta sprint.
- Export JSON/HTML fica pendente até a Sprint 6, embora o snapshot já esteja pronto.
- Lock na linha de `users` serializa escritas de currículo por usuário; aceitável para uso pessoal, mas precisaria de revisão em multi-usuário.
- `RESTRICT` em `resumes → resume_versions` e em `ats_analyses.job_id` exige checagens no service e testes de `409`; em `resume_versions.job_id` a ação é `SET NULL`, então a vaga pode ser excluída sem bloqueio.
- Extensão `seniority` no snapshot e dicionários de detecção de formação/idiomas são provisórios.

### Riscos

- **R1 — `ats_score`:** portão humano pode exigir o comportamento de `:522`; nesse caso é necessário rever imutabilidade, não apenas acrescentar um `UPDATE`.
- **R2 — Overlap de experiências:** somar períodos sobrepostos infla `anosReais`; critério literal da spec, mas merece decisão humana.
- **R3 — Precisão de meses:** inclusão de ambos os limites e conversão `/12` não são especificadas; duas implementações podem divergir por fração de ano.
- **R4 — Dicionários de detecção:** formação, certificação e idiomas dependem de listas de palavras não fornecidas pela spec; falso positivo muda 15 dos 100 pontos (10 + 5).
- **R5 — Senioridade inferida:** extensão `seniority` no snapshot pode ser rejeitada na revisão; sem ela, a dimensão de 20 pontos é sempre `notApplicable`.
- **R6 — Aliases e símbolos:** canonicalização incompleta (`c++`, `c#`, `.net`, `node.js`, `ci/cd`) pode gerar match falso; coberto por testes unitários pendentes.
- **R7 — Tamanho do JSON:** `content_snapshot` e `breakdown` são `json` sem validação no MySQL; integridade depende da aplicação, como `benefits` no ADR 0004.
- **R8 — `DELETE /v1/resumes/:id`:** se o humano confirmar que a contagem é 8 e este endpoint sai, é quebra de contrato em relação à spec `:414`; decisão 18 registra o ponto.
- **R9 — `totalPages` e `page`:** página além do fim devolve `data: []`; igual ao ADR 0004, mas exige teste para não confundir com `404`.
- **R10 — Nada executado:** nenhum comando, migration, teste, demo, revisão ou commit foi feito por este ADR; o backend-dev precisa validar tudo localmente antes do portão humano.

## Validação local

Nada foi implementado ou executado até aqui. O architect escreveu apenas este ADR; não rodou `lint`, `build`, testes, migrations, Docker, `git` nem leu `.env`. Todos os itens abaixo estão **pendentes** e devem ser preenchidos pelo backend-dev com resultado real, sem “verde” presumido.

| Verificação | Status |
|---|---|
| `npm ci` / ambiente local | [ ] Pendente |
| `npm run lint` | [ ] Pendente |
| `npx tsc --noEmit -p tsconfig.json` | [ ] Pendente |
| `npm run build` | [ ] Pendente |
| `npm test` (unitários do motor: normalizer, job-parser, resume-extractor, scorer, checks) | [ ] Pendente |
| `npm run test:e2e` com MySQL local (8 rotas + `DELETE`) | [ ] Pendente |
| `npm run migration:run` → `revert` → `run` → `show` (5 migrations ao final) | [ ] Pendente |
| `npm run typeorm -- schema:log -d src/database/data-source.ts` sem drift | [ ] Pendente |
| `SHOW INDEX` nas três tabelas sem índice redundante | [ ] Pendente |
| `git diff --check` | [ ] Pendente |
| Revisão read-only de código e Swagger `/docs` | [ ] Pendente |
| Demo manual e decisão de commit/push/PR/merge/deploy | [ ] Pendente — humano |

## Checklist para o backend-dev

- [ ] Criar `1795737600000-CreateResumeDomain.ts` com classe `CreateResumeDomain1795737600000`, `synchronize: false`, `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`, colunas/tipos/FKs/índices exatamente como em Modelo de dados; não gerar migration automática com `synchronize`.
- [ ] Criar entidades no singular mapeadas explicitamente para as tabelas no plural — `Resume` → `@Entity('resumes')`, `ResumeVersion` → `@Entity('resume_versions')`, `AtsAnalysis` → `@Entity('ats_analyses')` — com `@PrimaryGeneratedColumn('uuid')`, `datetime(6)` e FKs idênticas em nome à migration; usar `FK_resume_versions_job ... ON DELETE SET NULL` (não `RESTRICT`).
- [ ] Garantir ausência de `updated_at` e de qualquer `UPDATE`/`DELETE` em `resume_versions` e `ats_analyses`; `ats_score` inserido como `NULL`.
- [ ] Implementar o builder de snapshot a partir de `profile` e filhas, com `schemaVersion: "1.0"`, `generatedAt` UTC, `projects: []`, `seniority` provisória e ordenação determinística de experiências/bullets.
- [ ] Implementar `normalize`, `parseJob`, `extractResume`, `runChecks` e `score` em `src/modules/ats/engine/`, puros, tipados, sem `any`, com imports ESM `.js`.
- [ ] Aplicar pesos 35/10/20/15/10/5/5, renormalização de não aplicáveis, clamp 0..100 e os 10 checks na ordem da spec.
- [ ] Calcular `anosReais` com `generatedAt`, meses inclusivos, `current = true` até essa data; manter `skills[].years` apenas informativo.
- [ ] Implementar as rotas e DTOs da tabela de Contratos de API, com whitelist estrita, UUID validation, ownership, envelope `{ data, meta }` e Swagger.
- [ ] Implementar geração de versão com `pessimistic_write` no `resume`, `MAX(version) + 1` começando em 1, `ER_DUP_ENTRY` de `UQ_resume_versions_resume_version` com uma repetição e `409` final.
- [ ] Implementar default único com lock na linha de `users`, primeiro currículo como default e `409` para nome duplicado (`UQ_resumes_user_name`).
- [ ] Implementar análise transacional gravando somente `ats_analyses`; validar posse de vaga, divergência de `jobId` → `400` e leitura da última análise em `GET .../analysis`.
- [ ] Ajustar `ResumesService.remove` para `409` quando houver versões, mantendo `204` sem versões; não tocar em `applications` nem em `resumeVersionId`.
- [ ] Não implementar rotas de export, `DELETE /v1/resume-versions/:id`, listagem de versões/análises, `sort` nem alterações em `applications`.
- [ ] Rodar `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npm test`, `npm run test:e2e`, cadeia de migrations e `schema:log`; preencher a seção Validação local com resultados reais.
- [ ] Entregar sem commit; aguardar revisão humana, demo e decisão de commit/push/PR/merge/deploy.

## Validação humana pendente

Nenhuma das decisões abaixo bloqueia a implementação; todas são **provisórias** ou **registradas como exceção** e devem ser confirmadas, ajustadas ou revertidas no portão final (revisão, testes, demo e decisão de commit). Uma mudança vira ajuste documentado neste ADR, não alteração implícita de código.

| # | Ambiguidade / amarra | O que a decisão adotada significa na prática | Portão final |
|---|---|---|---|
| 1 | Export na Sprint 5 | Nenhuma rota `?format=json|html`; export fica em KAN-50/KAN-51 | Confirmar se a Fase 3 precisa ser fechada antes da Sprint 6 |
| 2 | `ats_score` vs imutabilidade | Coluna existe, fica **sempre `NULL`**, sem `UPDATE` em `resume_versions`; score servido de `ats_analysis.score` | Confirmar se `:522` é obrigatória; se sim, rever imutabilidade formalmente |
| 3 | `applications.resume_version_id` / ADR 0004 `:98` (“SEM FK até a Sprint 5”) | Decisão provisória reforçada: **Sprint 5 não cria a FK, não altera `applications` e não faz backfill**; coluna segue `null` | Confirmar se a frase do ADR 0004 era promessa de FK nesta sprint; se sim, vira nova história + migration, não ajuste silencioso |
| 4 | `GET .../analysis` | Última análise, `404` se não houver | Confirmar se o produto quer histórico/array ou filtro por `jobId` |
| 5 | Corpo de `POST /analyze` | `jobId` obrigatório no body; versão nunca é alterada | Confirmar se a vaga deveria vir implicitamente de `resume_version.job_id` |
| 6 | Versão começando em 1 | `version = 1` na primeira geração | Confirmar numeração para currículos importados no futuro |
| 7 | Default único sem índice no banco | Lock na linha de `users`; no máximo um `is_default = 1` | Confirmar se aceita dependência de service ou prefere generated column com nova migration |
| 8 | Primeiro currículo / limpar default | Primeiro vira default; `isDefault: false` pode deixar zero defaults | Confirmar se deve existir sempre um default |
| 9 | Exclusão de `resume` com versões | `409`, nunca `CASCADE` | Confirmar se exclusão lógica/arquivamento entra em história futura |
| 10 | Nomes de tabela (decisão do tech lead) | Conceito no singular conforme a spec; tabela física no plural (`resumes`, `resume_versions`, `ats_analyses`) com `@Entity('...')` nas entidades `Resume`/`ResumeVersion`/`AtsAnalysis`; `sprint-05.md` permanecerá com a redação mista do product-owner | Confirmar coerência com a exceção `application_status_history` e com o padrão `users`/`profiles`/`applications` do ADR 0004 `:83-87` |
| 11 | Contagem de rotas | Nove endpoints incluindo `DELETE /v1/resumes/:id` | Confirmar se a contagem “8” pretendia excluir `DELETE` |
| 12 | Paginação de currículos | `{ data, meta }`, `page`/`limit`, `?sort=` → `400` | Confirmar alinhamento com a listagem simples de empresas/recrutadores |
| 13 | Anos reais | `generatedAt`, meses inclusivos, sobreposições somadas | Confirmar arredondamento para anos e se sobreposição deve ser deduplicada |
| 14 | `yearsRequired` múltiplo | Maior número encontrado pela regex | Confirmar se “5+ anos” deve ser tratado como 5 |
| 15 | Skill `years` | Informativo; `anosReais` vem só das experiências | Confirmar se skill years deve somar/peso na dimensão de anos |
| 16 | Senioridade no snapshot | Campo `seniority` provisório copiado do perfil | Confirmar extensão do contrato de `:310-357` ou outra fonte |
| 17 | Detecção de formação/certificação/idiomas | Dicionário determinístico provisório no `job-parser` | Validar fixtures realistas e aprovar lista de termos |
| 18 | Peso do match e ordenação de experiências | Maior peso de seção; `current` primeiro, `startDate DESC`, `sortOrder ASC`, `id ASC` | Confirmar contra currículos de exemplo do produto |
| 19 | `breakdown.effectiveWeight` | Campo extra para explicar renormalização | Confirmar se o formato de `:268-289` deve permanecer estritamente fechado |
| 20 | Ausência de testes/demo | Tudo pendente neste ADR | Humanos executam e decidem commit/push/PR/merge/deploy; nenhum agente faz isso |
| 21 | `FK_resume_versions_job = SET NULL` e a criação de versão | O tech lead escreveu que “nenhuma rota da Sprint 5 preenche” `job_id`; este ADR preserva a decisão 14 (`jobId?` opcional **apenas na inserção** da versão, validado como vaga do usuário) e entende a frase como “nenhuma rota altera/preenche uma versão já gravada” — `POST /analyze` nunca a modifica | Confirmar a leitura literal: se nenhuma rota puder sequer enviar `jobId`, remove-se o campo de `CreateResumeVersionDto` **sem mudança de schema**; o `SET NULL` continua válido de qualquer forma |
| 22 | Timestamp `1795737600000` | Tech lead conferiu a cadeia `1794182400000`, `1794268800000`, `1794960000000`, `1795046400000`; não há conflito e não se renomeiam migrations antigas | Confirmar com `migration:show` após o backend-dev aplicar a migration |

## Referências

- `docs/prompt-kandid.md:78-84` (convenções, UUID, `created_at`/`updated_at`, imutabilidade de `resume_version`), `:90-117` (perfil, skills e experiências de origem do snapshot), `:128-133` (vaga e `job_skill`), `:137-142` (`applications` e histórico), `:147-158` (modelo de currículos/ATS), `:159-176` (enums, inclusive `Seniority`), `:205-305` (motor ATS, pesos, checks e formato persistido), `:306-372` (snapshot e export), `:374-433` (API e convenções), `:516-524` (Fase 3).
- `docs/backlog.md:15` (E4 planejado), `:102-109` (KAN-40..43), `:111-117` (E5 com KAN-50/KAN-51 de export na Sprint 6).
- `docs/adr/0004-sprint-4-applications.md:45-71` (resolução de conflitos), `:74-158` (modelo, FKs explícitos e índices sem duplicata), `:217-247` (DTOs e whitelist), `:300-328` (transação com lock e append-only), `:518-542` (portão humano).
- `docs/adr/0003-sprint-3-pipeline.md:239` (listagem de empresas), `:269-273` (cinco endpoints por CRUD), `:306-407` (migration, plural, FKs e índices).
- `docs/adr/0002-sprint-2-profile.md` (helpers, datas e tradução de `ER_DUP_ENTRY` reaproveitados).
- `docs/sprints/sprint-05.md` — escrito em paralelo pelo product-owner com as histórias KAN-40..43; o tech lead relatou a mistura de nomenclatura (`resumes` no plural e `resume_version`/`ats_analysis` no singular), resolvida neste ADR. O ADR apenas referencia o documento: o architect não o editou e não afirma ter conferido linhas específicas dele.
- `AGENTS.md` (prefixo `/v1`, Swagger, ownership, migrations versionadas, `.env` proibido, parada antes de commit) e `kandid_api/AGENTS.md` (comandos de qualidade).
