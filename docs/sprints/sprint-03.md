# Sprint 3 — Pipeline (empresas, recrutadores e vagas)

- Status: Implementada localmente — aguardando validação humana (testes, demo e commit)
- Branch: `feat/sprint-2-profile` (branch atual; Sprint 2 e Sprint 3 ficam juntas, uncommitted, até o humano decidir commit/separação). Nenhuma branch nova foi criada: decisão do tech lead para não separar o trabalho não commitado da Sprint 2 (HEAD `00b0647`).
- Início: 2026-11-18 (documento de planejamento)
- Encerramento local: 2026-11-18 — implementação e verificações estáticas/migration concluídas; o fechamento final depende de testes, demo manual e commit pelo humano
- Épico: E2 (`docs/backlog.md`)

## Objetivo

Permitir que o usuário autenticado cadastre empresas, recrutadores e vagas com stack,
senioridade e faixa salarial, e encontre vagas por filtros e paginação, deixando o
pipeline pronto para as candidaturas da Sprint 4.

## Escopo

### Histórias

| ID | História | Entrega principal | Estimativa |
|---|---|---|---|
| KAN-20 | CRUD de empresas | CRUD de `/v1/companies`, filtro `kind`, `unique(user_id, name)` | 1 dia |
| KAN-21 | CRUD de recrutadores | CRUD de `/v1/recruiters` com `agencyCompanyId` e e-mail opcional | 1 dia |
| KAN-22 | CRUD de vagas com stack e faixa | CRUD de `/v1/jobs`, `job_skill`, faixa em centavos, filtros e paginação | 2 dias |

Definition of Ready por história: critérios Given/When/Then abaixo, contrato na seção
Contratos, demo manual executável, dependências listadas e estimativa ≤ 2 dias.

### Decisões registradas (humano / tech lead)

1. **KAN-22 inclui filtros e paginação** na listagem: `companyId`, `seniority`, `skillId`,
   `q`, `page`, `limit`. Resposta no envelope `{ data, meta: { page, limit, total, totalPages } }`.
2. **Filtro `status` OMITIDO**: a spec da rota `GET /v1/jobs` lista `?status`, mas a entidade
   `job` não possui campo `status`. Ressalva: inconsistência do spec; não implementar e não
   inventar campo. Se algum dia fizer sentido, o status deve ser derivado das candidaturas
   na Sprint 4 (E3). Parâmetros fora da lista da decisão 1 (inclusive `sort`) não são
   aceitos; a ordenação é fixa e estável.
3. **Desvio do DoD nesta execução**: por instrução explícita do usuário, TESTES (unitários
   e e2e), DEMO MANUAL e COMMIT não foram escritos, executados ou feitos pelo time; o
   humano fará ao final. Os demais itens do DoD foram verificados (ver Definition of Done).
4. **Branch mantida**: `feat/sprint-2-profile`. Sprint 2 e Sprint 3 ficam juntas e
   uncommitted até o humano decidir commit ou separação; nenhuma branch nova é criada.

### Resolução de conflitos entre este documento e o ADR 0003 (tech lead)

O ADR 0003 (`docs/adr/0003-sprint-3-pipeline.md`) e este documento divergiam em cinco
pontos. O tech lead decidiu, e a implementação deve seguir **esta** seção:

| Tema | Decisão | Justificativa |
|---|---|---|
| Exclusão de empresa com vagas | **409 + `ON DELETE RESTRICT`** em `jobs.company_id`; o service checa vagas antes de deletar | Evita perda silenciosa de histórico de vagas; erro explícito é mais seguro que cascade |
| Filtro `?companyId=` alheio/inexistente | **envelope vazio** (`total: 0`) | Filtro de coleção apenas estreita resultados; `404` fica reservado a recurso por `:id` |
| Parâmetro `?sort=` | **rejeitado com 400** | O humano aprovou apenas os seis parâmetros (`companyId`, `seniority`, `skillId`, `q`, `page`, `limit`); `sort` ampliaria o contrato |
| `skillId` repetido no array `skills` | **400**, antes de qualquer escrita | Duplicata dentro do payload é requisição malformada, não conflito com estado persistido; 409 fica para corrida no banco |
| Campos do filtro `q` | **`title` e `description`** | Escopo aprovado; incluir `company.name` ampliaria o contrato sem aprovação |

As demais decisões do ADR 0003 permanecem: campos descritivos anuláveis, `recruiter.email`
opcional normalizado, `salaryPeriod` obrigatório, `money.ts` com `fieldName` opcional,
substituição atômica de stack, `status` rejeitado com 400, FKs opcionais com `SET NULL` e
tabelas em plural. A exceção `RESTRICT` acima substitui o `CASCADE` proposto para
`jobs.company_id` na Decisão 10 do ADR; o ADR 0003 já foi atualizado pelo
`tech-writer` e está em `Accepted`.

### Dependências

- Sprint 1 e 2 disponíveis na branch atual: `users`, JWT com `sub`, `JwtAuthGuard`,
  `@CurrentUser()`, `ValidationPipe` com `whitelist`/`forbidNonWhitelisted` e filtro único
  de erro.
- Migration `1794268800000-CreateProfileDomain` aplicada; `synchronize: false` mantido.
- Catálogo `skills` semeado por `npm run seed:skills` (somente leitura pela API),
  necessário para validar `skillId` em `job_skill`.
- BUILD executado nesta branch por decisão do tech lead; a aprovação humana final
  (revisão, testes, demo e commit) continua pendente no portão de validação.

### Fora de escopo

- Candidaturas e máquina de estados (KAN-30 a KAN-33), incluindo
  `GET /v1/jobs/:id/application` e qualquer filtro por status de candidatura.
- Currículos, versões, ATS e export JSON/HTML (KAN-40 a KAN-43, KAN-50 e KAN-51).
- Entrevistas e dashboards (KAN-52 a KAN-54).
- Seed de demonstração (KAN-60), deploy e banco remoto (KAN-7 e KAN-8).
- Paginação e filtros em `companies` e `recruiters` (exceto `?kind` em companies), busca
  textual `q` em companies, `sort` configurável e qualquer endpoint novo.
- Testes unitários/e2e e commit nesta execução (desvio registrado no DoD).
- Roles, permissões, multi-tenant, IA, PDF/DOCX e upload de arquivos.

## Validação local (2026-11-18)

Executada na branch `feat/sprint-2-profile`, com HEAD `00b0647` e MySQL local.
Nada foi executado em ambiente remoto.

| Verificação | Resultado |
|---|---|
| `npm run lint` | exit 0; 1 warning preexistente em `test/auth.e2e-spec.ts:232` |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `npm run migration:run` | aplicou `1794960000000-CreatePipelineDomain` (exit 0) |
| `npm run migration:revert` | exit 0; o `down()` dropa exatamente os nomes de FKs criados pelo `up()` (gerados pelo TypeORM) |
| `npm run migration:run` (reaplicação) | exit 0 |
| `npm run migration:show` | 3 migrations aplicadas |
| `npm run typeorm -- schema:log -d src/database/data-source.ts` | `Your schema is up to date`, exit 0 — sem drift |
| `synchronize: false` | mantido |
| Testes unitários e e2e | nenhum teste escrito ou executado nesta execução, por instrução explícita do usuário |
| Demo manual | não executada pelo time; pendente para o humano |
| Git | nenhum commit, push, PR, merge ou deploy; alterações seguem uncommitted em `00b0647` |

O ciclo completo `revert` → `run` → `schema:log` foi validado localmente, então
o `down()` da migration não é uma pendência. Permanecem pendentes para o humano:
testes unitários/e2e, demo manual e commit/push/PR/merge/deploy.

## Critérios de aceite

### KAN-20 — CRUD de empresas

**Como** usuário autenticado **quero** cadastrar e manter minhas empresas **para**
associá-las a recrutadores e vagas do meu pipeline.

- Dado que estou autenticado, quando envio `name` e `kind` válidos a `POST /v1/companies`, então recebo 201 com a empresa criada e `userId` igual ao `sub` do token.
- Dado que `name` está ausente/vazio ou `kind` está fora de `CLIENT|AGENCY|OTHER`, quando crio ou atualizo empresa, então recebo 400 indicando o campo inválido.
- Dado que envio `userId`, `user_id` ou qualquer campo fora do DTO, quando crio ou atualizo empresa, então recebo 400 e nada é persistido; o `userId` nunca é aceito no body.
- Dado que já tenho empresa com o mesmo `name`, quando crio outra com o mesmo `name`, então recebo 409 por `unique(user_id, name)`; outro usuário pode usar o mesmo nome.
- Dado que listo `GET /v1/companies`, então recebo somente as minhas empresas, em array, ordenadas por `name` ASC com desempate por `createdAt` DESC e `id` ASC.
- Dado que informo `?kind=AGENCY`, quando listo, então recebo apenas empresas desse tipo; `kind` inválido na query → 400.
- Dado que informo um `:id`, quando chamo `GET /v1/companies/:id`, então recebo 200 com os dados persistidos; id inexistente ou de outro usuário → 404.
- Dado que envio `PATCH /v1/companies/:id` com apenas `industry`, então recebo 200 e somente `industry` muda; campos ausentes permanecem inalterados.
- Dado que envio `null` explícito em `website`, `industry`, `size`, `location` ou `notes`, quando atualizo, então o campo é limpo no banco e retornado como `null`; dado `null` em `name` ou `kind`, então recebo 400.
- Dado que a empresa pertence a outro usuário ou não existe, quando chamo `GET`, `PATCH` ou `DELETE /v1/companies/:id`, então recebo 404 sem revelar existência.
- Dado que excluo empresa sem vagas vinculadas, quando chamo `DELETE /v1/companies/:id`, então recebo 204 sem corpo; se houver vagas vinculadas, então recebo 409 e nada é removido; vínculos de `recruiter.agencyCompanyId` são limpos (`SET NULL`).
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/companies`, então recebo 401.

### KAN-21 — CRUD de recrutadores

**Como** usuário autenticado **quero** gerenciar meus recrutadores **para** vinculá-los às vagas do meu pipeline.

- Dado que estou autenticado, quando envio `name` válido a `POST /v1/recruiters`, então recebo 201 com o recrutador criado e `userId` igual ao `sub` do token.
- Dado que `name` está ausente, vazio ou `null`, quando crio ou atualizo recrutador, então recebo 400.
- Dado que envio `email` presente e inválido, quando crio ou atualizo, então recebo 400; `email` ausente ou `null` é aceito, sem constraint de unicidade (conforme a spec).
- Dado que envio `agencyCompanyId` de empresa minha, quando crio ou atualizo, então recebo 201/200 com o vínculo; empresa alheia ou inexistente → 404; `null` limpa o vínculo e o retorna como `null`.
- Dado que envio `userId`, `user_id` ou campo fora do DTO, quando crio ou atualizo recrutador, então recebo 400 e nada é persistido.
- Dado que listo `GET /v1/recruiters`, então recebo somente os meus, em array, ordenados por `name` ASC com desempate por `createdAt` DESC e `id` ASC.
- Dado que informo um `:id`, quando chamo `GET /v1/recruiters/:id`, então recebo 200 com os dados persistidos; id inexistente ou alheio → 404.
- Dado que envio `PATCH /v1/recruiters/:id` com apenas `phone`, então recebo 200 e somente `phone` muda; `null` em `email`, `phone`, `linkedinUrl`, `agencyCompanyId` ou `notes` limpa o campo; campos ausentes permanecem inalterados.
- Dado que o recrutador pertence a outro usuário ou não existe, quando chamo `GET`, `PATCH` ou `DELETE /v1/recruiters/:id`, então recebo 404 sem revelar existência; `DELETE` com sucesso → 204 e o `recruiter_id` das vagas é limpo (`SET NULL`).
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/recruiters`, então recebo 401.

### KAN-22 — CRUD de vagas com stack e faixa salarial

**Como** usuário autenticado **quero** cadastrar vagas com empresa, recrutador, stack e
faixa salarial **para** organizar e encontrar oportunidades no meu pipeline.

- Dado que estou autenticado, quando envio `companyId` meu, `title` e `source` válidos a `POST /v1/jobs`, então recebo 201 com a vaga criada e `userId` igual ao `sub` do token; `recruiterId` é opcional.
- Dado que `companyId`, `title` ou `source` está ausente/vazio/`null`, quando crio vaga, então recebo 400; `source` fora de `LINKEDIN|GUPY|INDEED|REFERRAL|COMPANY_SITE|OTHER` → 400.
- Dado que `companyId` ou `recruiterId` pertence a outro usuário ou não existe, quando crio ou atualizo vaga, então recebo 404 sem revelar existência.
- Dado que envio `seniority`, `workModel`, `contractType` ou `salaryPeriod` fora do enum da spec, quando crio ou atualizo, então recebo 400; `salaryPeriod` é obrigatório e não aceita `null`.
- Dado que envio `skills` com itens `{ skillId, isRequired }` e `skillId` existente no catálogo, quando crio vaga, então recebo 201 com a stack persistida em `job_skill` e `isRequired` default `true`.
- Dado que envio `skillId` inexistente no catálogo, quando crio ou atualizo, então recebo 404; `skillId` repetido no array `skills` → 400 (payload malformado) e nada é persistido; `409` fica reservado à corrida no banco em `job_skills` (`ER_DUP_ENTRY`).
- Dado que envio `PATCH /v1/jobs/:id` com `skills`, quando atualizo, então a stack é substituída por completo de forma atômica; `skills: []` remove todas; array ausente mantém a stack atual.
- Dado que envio `salaryRangeMinCents` e `salaryRangeMaxCents` como inteiros ≥ 0 em centavos, quando crio ou atualizo, então recebo 201/200 com `currency` default `BRL`; `min > max`, valor negativo ou não inteiro → 400.
- Dado que envio `currency` fora de três letras maiúsculas, quando crio ou atualizo, então recebo 400; `currency` omitida na criação → `BRL`.
- Dado que o driver MySQL devolve `bigint` como string, quando leio uma vaga, então a resposta expõe os centavos como número JSON e a persistência envia string.
- Dado que envio `postedAt` ou `applicationDeadline` em formato diferente de `YYYY-MM-DD` (com hora, por exemplo) ou data inexistente, quando crio ou atualizo, então recebo 400; valores válidos são persistidos e retornados no mesmo formato.
- Dado que listo `GET /v1/jobs` sem filtros, então recebo somente as minhas vagas dentro de `{ data, meta: { page, limit, total, totalPages } }`, com `page` default 1 e `limit` default 20 (máximo 100); `page < 1`, `limit < 1` ou `limit > 100` → 400.
- Dado que informo `?companyId=` de empresa minha, quando listo, então recebo apenas vagas dessa empresa; `companyId` alheio ou inexistente → envelope vazio (`total: 0`), sem 404 e sem revelar existência.
- Dado que informo `?seniority=SENIOR`, quando listo, então recebo apenas vagas com essa senioridade; valor fora do enum → 400; vaga sem senioridade não aparece.
- Dado que informo `?skillId=` existente no catálogo, quando listo, então recebo apenas vagas cuja stack contém a skill, obrigatória ou não; `skillId` inexistente no catálogo → 404.
- Dado que informo `?q=node`, quando listo, então recebo vagas cujo `title` ou `description` contém o termo após trim, lowercase e remoção de acentos; a combinação de filtros é AND.
- Dado que existem vagas empatadas, quando listo com qualquer combinação de filtros, então a ordem é estável: `postedAt` DESC (nulos por último), `createdAt` DESC, `id` ASC; `totalPages = ceil(total / limit)` (0 quando `total = 0`).
- Dado que envio `PATCH /v1/jobs/:id` com apenas `notes`, então recebo 200 e somente `notes` muda; `null` em `recruiterId`, `description`, `seniority`, `workModel`, `contractType`, `location`, `sourceUrl`, `salaryRangeMinCents`, `salaryRangeMaxCents`, `postedAt`, `applicationDeadline` ou `notes` limpa o campo e o retorna como `null`; `null` em `companyId`, `title`, `source`, `salaryPeriod` ou `currency` → 400.
- Dado que a vaga pertence a outro usuário ou não existe, quando chamo `GET`, `PATCH` ou `DELETE /v1/jobs/:id`, então recebo 404 sem revelar existência; `DELETE` com sucesso → 204 e as linhas de `job_skill` são removidas por cascata.
- Dado que envio `userId`, `user_id` ou campo fora do DTO em qualquer escrita de vaga, então recebo 400 e nada é persistido.
- Dado que envio `?status=` ou `?sort=` na listagem, então recebo 400; o filtro `status` não existe porque a entidade `job` não possui campo `status` (ressalva registrada nas decisões).
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/jobs`, então recebo 401.

## Contratos

Todas as rotas exigem `Authorization: Bearer <jwt>` e usam o prefixo global `/v1`.
O `userId` vem exclusivamente do token. Erros seguem
`{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/v1/companies` | `CreateCompanyDto` | 201 `CompanyResponseDto` | 400, 401, 409 |
| GET | `/v1/companies?kind=` | query `kind` opcional | 200 `CompanyResponseDto[]` | 400, 401 |
| GET | `/v1/companies/:id` | — | 200 `CompanyResponseDto` | 401, 404 |
| PATCH | `/v1/companies/:id` | `UpdateCompanyDto` | 200 `CompanyResponseDto` | 400, 401, 404 |
| DELETE | `/v1/companies/:id` | — | 204 sem corpo | 401, 404, 409 |
| POST | `/v1/recruiters` | `CreateRecruiterDto` | 201 `RecruiterResponseDto` | 400, 401, 404 |
| GET | `/v1/recruiters` | — | 200 `RecruiterResponseDto[]` | 401 |
| GET | `/v1/recruiters/:id` | — | 200 `RecruiterResponseDto` | 401, 404 |
| PATCH | `/v1/recruiters/:id` | `UpdateRecruiterDto` | 200 `RecruiterResponseDto` | 400, 401, 404 |
| DELETE | `/v1/recruiters/:id` | — | 204 sem corpo | 401, 404 |
| POST | `/v1/jobs` | `CreateJobDto` | 201 `JobResponseDto` | 400, 401, 404, 409 |
| GET | `/v1/jobs` | query `companyId`, `seniority`, `skillId`, `q`, `page`, `limit` | 200 envelope paginado | 400, 401, 404 |
| GET | `/v1/jobs/:id` | — | 200 `JobResponseDto` | 401, 404 |
| PATCH | `/v1/jobs/:id` | `UpdateJobDto` | 200 `JobResponseDto` | 400, 401, 404, 409 |
| DELETE | `/v1/jobs/:id` | — | 204 sem corpo | 401, 404 |

Exemplo de criação de vaga (`POST /v1/jobs`):

```json
{
  "companyId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  "recruiterId": "2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e",
  "title": "Desenvolvedor Backend Sênior",
  "description": "Node.js, TypeScript e PostgreSQL. Remoto.",
  "seniority": "SENIOR",
  "workModel": "REMOTE",
  "contractType": "CLT",
  "location": "Remoto",
  "source": "LINKEDIN",
  "sourceUrl": "https://linkedin.com/jobs/view/123",
  "salaryRangeMinCents": 800000,
  "salaryRangeMaxCents": 1200000,
  "salaryPeriod": "MONTH",
  "postedAt": "2026-11-18",
  "applicationDeadline": "2026-12-18",
  "skills": [
    { "skillId": "3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f", "isRequired": true },
    { "skillId": "4e5f6071-8293-4dae-bf20-3b4c5d6e7f80", "isRequired": false }
  ],
  "notes": "Vaga de plataforma."
}
```

Exemplo de listagem (`GET /v1/jobs?q=node&seniority=SENIOR&page=1&limit=20`):

```json
{
  "data": [
    {
      "id": "5f607182-93a4-4be1-8031-4c5d6e7f8091",
      "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
      "companyId": "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
      "recruiterId": "2c3d4e5f-6071-4b8c-9d0e-1f2a3b4c5d6e",
      "title": "Desenvolvedor Backend Sênior",
      "description": "Node.js, TypeScript e PostgreSQL. Remoto.",
      "seniority": "SENIOR",
      "workModel": "REMOTE",
      "contractType": "CLT",
      "location": "Remoto",
      "source": "LINKEDIN",
      "sourceUrl": "https://linkedin.com/jobs/view/123",
      "salaryRangeMinCents": 800000,
      "salaryRangeMaxCents": 1200000,
      "currency": "BRL",
      "salaryPeriod": "MONTH",
      "postedAt": "2026-11-18",
      "applicationDeadline": "2026-12-18",
      "notes": "Vaga de plataforma.",
      "skills": [
        {
          "skillId": "3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f",
          "isRequired": true,
          "skill": {
            "id": "3d4e5f60-7182-4c9d-ae1f-2a3b4c5d6e7f",
            "name": "Node.js",
            "slug": "node-js",
            "category": "FRAMEWORK",
            "aliases": ["Node", "NodeJS"]
          }
        }
      ],
      "createdAt": "2026-11-18T12:00:00.000Z",
      "updatedAt": "2026-11-18T12:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

## Regras de negócio

1. **Ownership**: `userId` vem do JWT (`@CurrentUser()`); toda consulta e escrita é filtrada
   por ele. `userId`, `user_id` e `profileId` não são aceitos em body, query ou param.
   Recurso alheio ou inexistente responde **404**, nunca 403. Em filtro de listagem,
   `companyId` alheio devolve envelope vazio, sem revelar existência.
2. **Empresas**: `name` e `kind` são obrigatórios; `unique(user_id, name)` gera **409**
   (inclusive em corrida via `ER_DUP_ENTRY`). Colunas anuláveis aceitam `null` explícito no
   PATCH; campo ausente permanece inalterado. `kind` é o único filtro de listagem.
3. **Recrutadores**: `name` obrigatório; `email` opcional e validado quando presente;
   `agencyCompanyId` opcional e restrito a empresa do mesmo usuário (alheia/inexistente →
   404). Não há UNIQUE em e-mail, conforme a spec.
4. **Vagas**: `companyId`, `title`, `source` e `salaryPeriod` são obrigatórios;
   `currency` default `BRL`. `companyId` e `recruiterId` devem pertencer ao mesmo usuário.
   `job_skill` tem PK composta `(job_id, skill_id)`; `skillId` deve vir do catálogo.
   `skillId` repetido no payload → `400`; corrida no banco (`ER_DUP_ENTRY`) → `409`.
5. **Stack no PATCH**: array `skills` enviado substitui a stack inteira em uma transação;
   `[]` remove todas; omitido mantém as atuais.
6. **Dinheiro**: centavos como inteiro `>= 0`, persistidos em `bigint` (string no driver) e
   expostos como número JSON; `min <= max` quando ambos presentes; `currency` ISO 4217 de
   três letras maiúsculas.
7. **Datas**: `postedAt` e `applicationDeadline` usam estritamente `YYYY-MM-DD`; comparação
   nunca como texto solto. `createdAt`/`updatedAt` permanecem ISO 8601 UTC.
8. **Filtros e paginação de vagas**: AND entre filtros; `q` normalizado (trim, lowercase,
   sem acentos) sobre `title` e `description`; `seniority` validado por enum; `skillId`
   exists no catálogo; `page` default 1, `limit` default 20 e máximo 100. Envelope
   `{ data, meta }` com `totalPages = ceil(total / limit)`.
9. **Ordenação**: companies e recruiters por `name ASC, createdAt DESC, id ASC`; jobs por
   `postedAt DESC` (nulos por último), `createdAt DESC`, `id ASC`. Sem `sort` configurável.
10. **Exclusão**: `DELETE` com sucesso → 204 sem corpo. Empresa com vagas → 409
    (`ON DELETE RESTRICT` em `job.company_id`); `recruiter.agency_company_id`,
    `job.recruiter_id` usam `SET NULL`; `job_skill` usa `CASCADE`.
11. **Respostas e erros**: criação 201, leitura/atualização 200, remoção 204. Nenhum DTO
    expõe dados de autenticação. Erros seguem o filtro global, com mensagem indicando o
    campo inválido.

## Modelo de dados

Migration versionada `1794960000000-CreatePipelineDomain` aplicada localmente para
`companies`, `recruiters`, `jobs` e `job_skills`; `synchronize: false` mantido.
PKs `varchar(36)` com UUID e `created_at`/`updated_at` em `datetime(6)`. O
`down()` dropa exatamente as FKs criadas pelo `up()`; `revert` → `run` →
`schema:log` foi validado sem drift.

| Tabela | Campos principais | Restrições e FKs |
|---|---|---|
| `companies` | `id`, `user_id`, `name varchar(160)`, `kind enum`, `website varchar(255)`, `industry varchar(120)`, `size enum NULL`, `location varchar(160)`, `notes text` | UNIQUE `(user_id, name)`; FK `user_id → users.id` `ON DELETE CASCADE` |
| `recruiters` | `id`, `user_id`, `name varchar(120)`, `email varchar(160)`, `phone varchar(30)`, `linkedin_url varchar(255)`, `agency_company_id uuid NULL`, `notes text` | FK `user_id → users.id` `CASCADE`; FK `agency_company_id → companies.id` `SET NULL` |
| `jobs` | `id`, `user_id`, `company_id uuid`, `recruiter_id uuid NULL`, `title varchar(160)`, `description text`, `seniority enum NULL`, `work_model enum NULL`, `contract_type enum NULL`, `location varchar(160)`, `source enum`, `source_url varchar(255)`, `salary_range_min_cents bigint NULL`, `salary_range_max_cents bigint NULL`, `currency char(3) default 'BRL'`, `salary_period enum`, `posted_at date NULL`, `application_deadline date NULL`, `notes text` | FK `user_id → users.id` `CASCADE`; FK `company_id → companies.id` `RESTRICT`; FK `recruiter_id → recruiters.id` `SET NULL` |
| `job_skills` | `job_id uuid`, `skill_id uuid`, `is_required tinyint default 1` | PK composta `(job_id, skill_id)`; FK `job_id → jobs.id` `CASCADE`; FK `skill_id → skills.id` `CASCADE` (catálogo somente leitura) |

Não existe campo `status` em `jobs` (ressalva do spec registrada nas decisões).

## Demo manual

Pré-condição: MySQL local no Docker, `npm run migration:run`, `npm run seed:skills`,
`npm run start:dev` e Swagger em `/docs`. Use a branch `feat/sprint-2-profile`; não criar
branch nova nem commitar.

1. Registre dois usuários via `POST /v1/auth/register` e faça login para obter
   `TOKEN_A` e `TOKEN_B`. Guarde o `userId` de A para conferir que nunca aparece no body.
2. Como A, `POST /v1/companies` com `{"name":"Acme","kind":"CLIENT"}` e depois com
   `{"name":"Talent","kind":"AGENCY"}`. Repita o primeiro nome → 409.
   `GET /v1/companies?kind=AGENCY` → somente Talent. Guarde os dois `id`s.
3. Tente `GET /v1/companies/<id-da-agencia>` com `TOKEN_B` → 404.
4. Como A, `POST /v1/recruiters` com `name`, `email` válido e
   `agencyCompanyId=<id-da-agencia>` → 201. E-mail inválido → 400;
   `agencyCompanyId` de B ou inexistente → 404. Guarde o `id`.
5. Como A, `POST /v1/jobs` usando o JSON de exemplo acima, com um `skillId` real do
   catálogo (obtido em `GET /v1/skills?q=node`). Teste: duplicar `skillId` → 400;
   `min > max` → 400; `companyId` de B → 404; sem `currency` → resposta `BRL`.
6. `GET /v1/jobs?companyId=<id>&seniority=SENIOR&skillId=<skillId>&q=node&page=1&limit=20`
   → envelope com `data` e `meta`. Repita com `?status=...` → 400 (filtro omitido).
7. `PATCH /v1/jobs/<id>` com `{"recruiterId":null,"salaryRangeMaxCents":null}` → 200 com
   campos limpos; `PATCH` com `{"title":null}` → 400. Faça o mesmo com `skills: []` e
   confirme stack vazia.
8. `DELETE /v1/jobs/<id>` → 204; `DELETE /v1/companies/<id-da-acme>` com vaga vinculada
   → 409; após remover a vaga, `DELETE` → 204.
9. Com `TOKEN_B`, repita `GET`/`PATCH`/`DELETE` nos `:id` de A → 404 em todos; confirme
   que `GET /v1/jobs` de B não retorna vagas de A.
10. Sem header `Authorization`, repita uma rota de cada recurso → 401.

## Riscos

| Risco | Mitigação |
|---|---|
| Inconsistência do spec: `?status` em `/v1/jobs` sem campo `status` em `job` | Ressalva registrada; filtro omitido e rejeitado com 400; não criar campo. Reavaliar só quando E3 existir |
| Exclusão de empresa com vagas ou de recrutador referenciado | `RESTRICT` + 409 para empresa com vaga; `SET NULL` para vínculos opcionais; verificar na demo |
| `bigint` devolvido como string pelo driver MySQL | Conversão explícita no mapper de resposta e string na persistência; cenário na demo |
| `skillId` inválido por catálogo sem seed | Exigir `npm run seed:skills` nas pré-condições; `skillId` inexistente → 404 |
| Duplicata de skill em corrida | PK composta `(job_id, skill_id)` + tradução de `ER_DUP_ENTRY` para 409 |
| Vazamento entre usuários em filtros e por `:id` | Toda query parte do `userId` do JWT; alheio por `:id` → 404; em filtro → envelope vazio; demo com dois usuários |
| Ordenação instável por `postedAt` nulo ou empatado | Desempate fixo `createdAt DESC, id ASC`; nulos por último |
| `null` em coluna obrigatória no PATCH parcial | Reutilizar o padrão `hasField`/`assertNoForcedNull` da Sprint 2; critérios 400 explícitos |
| Ausência de testes nesta execução (desvio do DoD) | Demo manual ainda não foi executada: o humano deve cobrir 400/401/404/409 e dois usuários, além de executar unit/e2e ao final |
| Rota `GET /v1/jobs/:id/application` prevista na spec, mas fora do épico | Registrada como fora de escopo (E3); não implementar nem confundir com entrega concluída |
| Branch única com Sprint 2 + Sprint 3 uncommitted | Risco de misturar escopos no commit final; humano decide commit ou separação; nenhuma branch nova criada pelo time |
| Migration aplicada em banco local já existente | Migration versionada, forward-only e `synchronize: false`; rodar `migration:run` e conferir ausência de drift |

## Definition of Done

**Desvio explícito aprovado nesta execução (instrução do usuário):** TESTES (unitários e
e2e), DEMO MANUAL e COMMIT não foram escritos, executados ou feitos pelo time; o
humano fará ao final. Todos os demais itens abaixo foram verificados nesta branch.

Itens do time (verificáveis nesta branch):

- [x] KAN-20, KAN-21 e KAN-22 implementados; os critérios Given/When/Then estão especificados e a validação em runtime depende da demo manual.
- [x] `npm run lint` verde (exit 0; 1 warning preexistente em `test/auth.e2e-spec.ts:232`).
- [x] `npm run build` verde.
- [x] `npx tsc --noEmit` verde.
- [x] Migration versionada aplicada via `npm run migration:run`; ciclo `revert` → `run` → `schema:log` validado; `synchronize: false` sem drift.
- [x] Swagger em `/docs` com endpoints e DTOs documentados de companies, recruiters e jobs, incluindo envelope paginado e exemplos de request/response.
- [x] Nenhuma credencial ou segredo no código; `.env` não lido por agentes.
- [x] Todo recurso escopado por `userId` do JWT; `userId`/`user_id` rejeitados no body com 400; recurso alheio/inexistente → 404.
- [x] Filtro `status` não implementado e nenhum campo `status` criado em `job` (ressalva registrada).
- [x] Branch mantida em `feat/sprint-2-profile`; nenhuma branch nova criada; Sprint 2 e Sprint 3 seguem juntas e uncommitted.

Pendente para o humano (fora da execução do time, por decisão explícita):

- [ ] Executar a demo manual completa, incluindo isolamento entre dois usuários e os códigos 400/401/404/409 previstos, e registrar o resultado na validação humana.
- [ ] Escrever/executar testes unitários e e2e (`npm test` e `npm run test:e2e` com MySQL).
- [ ] Decidir commit e eventual separação entre Sprint 2 e Sprint 3; depois, fazer push, aprovar revisão/PR e merge/deploy.

## Tarefas

- [x] Migration versionada `1794960000000-CreatePipelineDomain` das tabelas `companies`, `recruiters`, `jobs` e `job_skills`, com `revert` → `run` → `schema:log` validados.
- [x] Implementar `CompaniesService` (CRUD, `unique(user_id, name)` → 409, filtro `kind`, PATCH parcial com `null`, exclusão com vagas → 409).
- [x] Implementar `RecruitersService` (CRUD, `agencyCompanyId` do mesmo usuário, e-mail opcional).
- [x] Implementar `JobsService` (CRUD, vínculos, stack, faixa em centavos, datas e PATCH parcial).
- [x] Implementar filtros, paginação e envelope `{ data, meta }` de `GET /v1/jobs`, com ordenação estável.
- [x] Documentar rotas e DTOs no Swagger, incluindo os exemplos desta sprint.
- [x] Rodar `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run migration:run`, `npm run migration:revert`, `npm run migration:run` (reaplicação) e `schema:log`.
- [ ] Executar a demo manual completa e registrar o resultado na validação humana — pendente para o humano.
- [x] Manter tudo em `feat/sprint-2-profile`, sem branch nova e sem commit.
