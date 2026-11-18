# Sprint 2 — Perfil profissional

- Status: Concluída — KAN-13 a KAN-16 implementados e validados localmente; commit/push pendentes de aprovação humana
- Início: 2026-11-10
- Encerramento: 2026-11-18 (validação local concluída; portões de commit, PR e revisão humana permanecem pendentes)

## Objetivo

Entregar o domínio de perfil profissional da API: perfil 1:1 com o usuário, experiências
com bullets, catálogo de skills com vínculos ao perfil, formação, certificações e idiomas.
Ao final da sprint, todo o conteúdo que alimenta o currículo estará disponível e escopado
pelo usuário autenticado, sem nenhum service lançando `NotImplementedException`.

## Escopo

### Histórias

| ID | História | Entrega principal | Status |
|---|---|---|---|
| KAN-13 | Criar e atualizar perfil | `GET /v1/me/profile` e `PATCH /v1/me/profile` com upsert | Concluída e validada localmente |
| KAN-14 | CRUD de experiências e bullets | Experiências e bullets aninhadas, com validação de datas | Concluída e validada localmente |
| KAN-15 | Catálogo e vínculo de skills | Busca no catálogo e CRUD dos vínculos do perfil | Concluída e validada localmente |
| KAN-16 | Formação, certificações e idiomas | CRUD de `educations`, `certifications` e `languages` | Concluída e validada localmente (risco de corrida de idioma registrado) |

Dependências:

- Sprint 1 concluída: `users`, JWT com `sub`, `JwtAuthGuard`, `@CurrentUser()` e formato único de erro.
- Migration `1794268800000-CreateProfileDomain` aplicada (tabelas do domínio).
- Catálogo de skills populado por seed do projeto (somente leitura pela API).

### Fora de escopo

- Vagas, empresas e recrutadores (E2 / Sprint 3).
- Candidaturas, entrevistas e máquina de estados (E3).
- Currículos, snapshots, motor ATS, keywords e score (E4).
- Export em JSON/HTML, PDF/DOCX e upload/armazenamento de arquivos (E5 e fora do MVP).
- CRUD de skills globais: o catálogo é somente leitura e semeado.
- Importação de currículo, parsing de vaga por URL e integração com LLM.
- Paginação, filtros e ordenação configurável por query nestas rotas (listas são completas e com ordenação fixa).
- Roles, permissões além de “usuário autenticado”, refresh token e exclusão de conta.
- Qualquer domínio da Sprint 3 em diante.

## Critérios de aceite

### KAN-13 — Criar e atualizar perfil

- Dado que estou autenticado e ainda não tenho perfil, quando chamo `GET /v1/me/profile`, então recebo 404 com mensagem clara e nenhum perfil é criado por efeito colateral.
- Dado que estou autenticado e ainda não tenho perfil, quando envio `PATCH /v1/me/profile` com dados válidos, então recebo 200 com o perfil criado, `userId` igual ao `sub` do token e `currency` igual a `BRL` quando não enviada.
- Dado que já tenho perfil, quando envio `PATCH /v1/me/profile` com apenas `headline`, então recebo 200 e somente `headline` muda; os demais campos permanecem iguais.
- Dado que envio `desiredSalaryCents` negativo, `currency` fora do padrão de três letras maiúsculas ou URL inválida em `linkedinUrl`, quando chamo `PATCH /v1/me/profile`, então recebo 400 indicando o campo inválido.
- Dado que envio `userId`, `user_id` ou qualquer campo fora do DTO no body, quando chamo `PATCH /v1/me/profile`, então recebo 400 e nenhum dado é persistido.
- Dado que não envio o header `Authorization`, quando chamo `GET` ou `PATCH /v1/me/profile`, então recebo 401.
- Dado que envio `null` explícito em um campo opcional, quando chamo `PATCH /v1/me/profile`, então o campo é limpo no banco e a resposta o retorna como `null`.
- Dado um perfil criado, quando chamo `GET /v1/me/profile`, então recebo os mesmos dados persistidos, sem `user`, `password_hash` ou qualquer dado de autenticação.

### KAN-14 — CRUD de experiências e bullets

- Dado que estou autenticado e tenho perfil, quando envio `companyName`, `role` e `startDate` válidos, então recebo 201 com a experiência criada, `bullets` vazias e `sortOrder` preenchido.
- Dado que envio `isCurrent=true` com `endDate` preenchida, quando crio ou atualizo uma experiência, então recebo 400 e nada é persistido.
- Dado que envio `isCurrent=false` sem `endDate`, quando crio ou atualizo uma experiência, então recebo 400 com mensagem indicando que `endDate` é obrigatória.
- Dado que envio `endDate` anterior a `startDate`, quando crio ou atualizo uma experiência, então recebo 400 e a data não é aceita como texto solto.
- Dado que envio `startDate` em formato diferente de `YYYY-MM-DD`, quando crio uma experiência, então recebo 400.
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/me/experiences`, então recebo 401.
- Dado que a experiência pertence a outro usuário, quando chamo `GET`, `PATCH` ou `DELETE /v1/me/experiences/:id`, então recebo 404, sem revelar a existência do recurso.
- Dado que estou autenticado e não tenho perfil, quando tento criar uma experiência, então recebo 404 de perfil não encontrado e nenhuma experiência é criada.
- Dado que adiciono uma bullet com `text` de até 500 caracteres, quando chamo `POST /v1/me/experiences/:id/bullets`, então recebo 201 com a bullet vinculada à experiência.
- Dado que envio bullet com `text` vazio ou acima de 500 caracteres, quando chamo a rota de bullets, então recebo 400.
- Dado que a bullet pertence a outra experiência do mesmo usuário, quando chamo `PATCH` ou `DELETE /v1/me/experiences/:id/bullets/:bulletId` com o `:id` errado, então recebo 404.
- Dado que removo uma experiência, quando chamo `DELETE /v1/me/experiences/:id`, então recebo 204 e as bullets associadas somem por cascata.
- Dado que listo minhas experiências, quando chamo `GET /v1/me/experiences`, então recebo apenas as minhas, ordenadas por `sortOrder` e depois por `startDate` decrescente.

### KAN-15 — Catálogo e vínculo de skills

- Dado que estou autenticado, quando chamo `GET /v1/skills?q=node`, então recebo skills cujo `name` ou `aliases` correspondem, com match exato antes de prefixo e de “contém”.
- Dado que chamo `GET /v1/skills` sem `q`, então recebo até 20 skills do catálogo, ordenadas por nome.
- Dado que envio `limit` maior que 50 ou menor que 1, quando chamo `GET /v1/skills`, então recebo 400.
- Dado que não envio o header `Authorization`, quando chamo `GET /v1/skills` ou qualquer rota de `/v1/me/skills`, então recebo 401.
- Dado que envio `skillId` existente, `level` válido e `yearsExperience` entre 0 e 99.9, quando chamo `POST /v1/me/skills`, então recebo 201 com o vínculo e os dados da skill do catálogo.
- Dado que tento vincular a mesma skill duas vezes ao meu perfil, quando chamo `POST /v1/me/skills`, então recebo 409 e o vínculo duplicado não é criado.
- Dado que envio `skillId` inexistente no catálogo, quando chamo `POST /v1/me/skills`, então recebo 404.
- Dado que envio `yearsExperience` com mais de uma casa decimal ou acima de 99.9, ou `lastUsedYear` no futuro, quando chamo `POST` ou `PATCH /v1/me/skills`, então recebo 400.
- Dado que envio `skillId` no `PATCH /v1/me/skills/:id`, então recebo 400 porque `skillId` é imutável.
- Dado que o vínculo pertence a outro usuário, quando chamo `PATCH` ou `DELETE /v1/me/skills/:id`, então recebo 404.
- Dado que removo um vínculo, quando chamo `DELETE /v1/me/skills/:id`, então recebo 204 e a skill continua existindo no catálogo.

### KAN-16 — Formação, certificações e idiomas

- Dado que estou autenticado e tenho perfil, quando crio uma formação com `institution`, `degree`, `fieldOfStudy` e `startDate` válidos, então recebo 201 e ela aparece em `GET /v1/me/educations`.
- Dado que envio `isCurrent=true` com `endDate` em formação, ou `isCurrent=false` sem `endDate`, quando crio ou atualizo, então recebo 400.
- Dado que envio `endDate` anterior a `startDate` em formação, então recebo 400.
- Dado que crio certificação com `issueDate` válida e `expiryDate` anterior a `issueDate`, então recebo 400.
- Dado que crio certificação já expirada, com `expiryDate` no passado, então recebo 201, pois o histórico é preservado.
- Dado que cadastro o mesmo idioma duas vezes variando caixa ou acento (por exemplo `Inglês` e `ingles`), então recebo 409.
- Dado que atualizo um idioma para um nome já cadastrado no meu perfil, então recebo 409.
- Dado que envio `proficiency` fora do enum, quando crio ou atualizo um idioma, então recebo 400.
- Dado que o registro de formação, certificação ou idioma pertence a outro usuário, quando chamo `GET`, `PATCH` ou `DELETE` pelo `:id`, então recebo 404.
- Dado que não envio o header `Authorization`, quando chamo qualquer rota de `/v1/me/educations`, `/v1/me/certifications` ou `/v1/me/languages`, então recebo 401.
- Dado que removo qualquer um desses registros, quando chamo `DELETE`, então recebo 204 e o registro deixa de aparecer na listagem.
- Dado que listo formações, certificações e idiomas, então recebo respectivamente ordenação por `startDate` desc, `issueDate` desc e `name` asc.

## Contratos

Todas as rotas exigem `Authorization: Bearer <jwt>` e usam o prefixo global `/v1`.
O `userId` vem exclusivamente do token; `user_id`, `profile_id` e `profileId` não são
aceitos em body, query ou param. Erros seguem `{ statusCode, error, message, path, timestamp }`.

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/v1/me/profile` | — | 200 `ProfileResponseDto` | 401, 404 |
| PATCH | `/v1/me/profile` | `UpdateProfileDto` | 200 `ProfileResponseDto` | 400, 401 |
| POST | `/v1/me/experiences` | `CreateExperienceDto` | 201 `ExperienceResponseDto` | 400, 401, 404 |
| GET | `/v1/me/experiences` | — | 200 `ExperienceResponseDto[]` | 401, 404 |
| GET | `/v1/me/experiences/:id` | — | 200 `ExperienceResponseDto` | 401, 404 |
| PATCH | `/v1/me/experiences/:id` | `UpdateExperienceDto` | 200 `ExperienceResponseDto` | 400, 401, 404 |
| DELETE | `/v1/me/experiences/:id` | — | 204 sem corpo | 401, 404 |
| POST | `/v1/me/experiences/:id/bullets` | `CreateExperienceBulletDto` | 201 `ExperienceBulletResponseDto` | 400, 401, 404 |
| PATCH | `/v1/me/experiences/:id/bullets/:bulletId` | `UpdateExperienceBulletDto` | 200 `ExperienceBulletResponseDto` | 400, 401, 404 |
| DELETE | `/v1/me/experiences/:id/bullets/:bulletId` | — | 204 sem corpo | 401, 404 |
| GET | `/v1/skills?q=&limit=` | query `q` (até 80), `limit` (1–50, default 20) | 200 `SkillResponseDto[]` | 400, 401 |
| GET | `/v1/me/skills` | — | 200 `ProfileSkillResponseDto[]` | 401, 404 |
| POST | `/v1/me/skills` | `CreateProfileSkillDto` | 201 `ProfileSkillResponseDto` | 400, 401, 404, 409 |
| PATCH | `/v1/me/skills/:id` | `UpdateProfileSkillDto` | 200 `ProfileSkillResponseDto` | 400, 401, 404 |
| DELETE | `/v1/me/skills/:id` | — | 204 sem corpo | 401, 404 |
| POST | `/v1/me/educations` | `CreateEducationDto` | 201 `EducationResponseDto` | 400, 401, 404 |
| GET | `/v1/me/educations` | — | 200 `EducationResponseDto[]` | 401, 404 |
| GET | `/v1/me/educations/:id` | — | 200 `EducationResponseDto` | 401, 404 |
| PATCH | `/v1/me/educations/:id` | `UpdateEducationDto` | 200 `EducationResponseDto` | 400, 401, 404 |
| DELETE | `/v1/me/educations/:id` | — | 204 sem corpo | 401, 404 |
| POST | `/v1/me/certifications` | `CreateCertificationDto` | 201 `CertificationResponseDto` | 400, 401, 404 |
| GET | `/v1/me/certifications` | — | 200 `CertificationResponseDto[]` | 401, 404 |
| GET | `/v1/me/certifications/:id` | — | 200 `CertificationResponseDto` | 401, 404 |
| PATCH | `/v1/me/certifications/:id` | `UpdateCertificationDto` | 200 `CertificationResponseDto` | 400, 401, 404 |
| DELETE | `/v1/me/certifications/:id` | — | 204 sem corpo | 401, 404 |
| POST | `/v1/me/languages` | `CreateLanguageDto` | 201 `LanguageResponseDto` | 400, 401, 404, 409 |
| GET | `/v1/me/languages` | — | 200 `LanguageResponseDto[]` | 401, 404 |
| GET | `/v1/me/languages/:id` | — | 200 `LanguageResponseDto` | 401, 404 |
| PATCH | `/v1/me/languages/:id` | `UpdateLanguageDto` | 200 `LanguageResponseDto` | 400, 401, 404, 409 |
| DELETE | `/v1/me/languages/:id` | — | 204 sem corpo | 401, 404 |

### PATCH `/v1/me/profile`

Request:

```json
{
  "headline": "Backend Developer",
  "summary": "Desenvolvedor backend com foco em Node.js e TypeScript.",
  "phone": "+55 11 99999-9999",
  "city": "São Paulo",
  "state": "SP",
  "country": "Brasil",
  "linkedinUrl": "https://linkedin.com/in/usuario",
  "githubUrl": "https://github.com/usuario",
  "portfolioUrl": "https://usuario.dev",
  "desiredRole": "Desenvolvedor Backend Sênior",
  "desiredSeniority": "SENIOR",
  "workModelPreference": "REMOTE",
  "desiredSalaryCents": 1500000,
  "currency": "BRL",
  "availableFrom": "2026-12-01"
}
```

Resposta (200):

```json
{
  "id": "5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12",
  "userId": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
  "headline": "Backend Developer",
  "summary": "Desenvolvedor backend com foco em Node.js e TypeScript.",
  "phone": "+55 11 99999-9999",
  "city": "São Paulo",
  "state": "SP",
  "country": "Brasil",
  "linkedinUrl": "https://linkedin.com/in/usuario",
  "githubUrl": "https://github.com/usuario",
  "portfolioUrl": "https://usuario.dev",
  "desiredRole": "Desenvolvedor Backend Sênior",
  "desiredSeniority": "SENIOR",
  "workModelPreference": "REMOTE",
  "desiredSalaryCents": 1500000,
  "currency": "BRL",
  "availableFrom": "2026-12-01",
  "createdAt": "2026-11-10T12:00:00.000Z",
  "updatedAt": "2026-11-10T12:00:00.000Z"
}
```

### Experiência com bullet

`POST /v1/me/experiences`:

```json
{
  "companyName": "Acme",
  "role": "Backend Developer",
  "employmentType": "CLT",
  "workModel": "REMOTE",
  "location": "Remoto",
  "startDate": "2023-01-01",
  "isCurrent": true,
  "description": "Atuação no time de plataforma.",
  "sortOrder": 0
}
```

`POST /v1/me/experiences/:id/bullets`:

```json
{
  "text": "Reduzi o tempo de resposta da API em 40%.",
  "sortOrder": 0
}
```

Resposta de `GET /v1/me/experiences/:id` (200):

```json
{
  "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "profileId": "5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12",
  "companyName": "Acme",
  "role": "Backend Developer",
  "employmentType": "CLT",
  "workModel": "REMOTE",
  "location": "Remoto",
  "startDate": "2023-01-01",
  "endDate": null,
  "isCurrent": true,
  "description": "Atuação no time de plataforma.",
  "sortOrder": 0,
  "bullets": [
    {
      "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "experienceId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "text": "Reduzi o tempo de resposta da API em 40%.",
      "sortOrder": 0,
      "createdAt": "2026-11-10T12:00:00.000Z",
      "updatedAt": "2026-11-10T12:00:00.000Z"
    }
  ],
  "createdAt": "2026-11-10T12:00:00.000Z",
  "updatedAt": "2026-11-10T12:00:00.000Z"
}
```

### Vínculo de skill

`POST /v1/me/skills`:

```json
{
  "skillId": "3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e",
  "level": "ADVANCED",
  "yearsExperience": 5.5,
  "lastUsedYear": 2026
}
```

Resposta (201):

```json
{
  "id": "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a",
  "profileId": "5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12",
  "skillId": "3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e",
  "level": "ADVANCED",
  "yearsExperience": 5.5,
  "lastUsedYear": 2026,
  "skill": {
    "id": "3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e",
    "name": "Node.js",
    "slug": "node-js",
    "category": "FRAMEWORK",
    "aliases": ["Node", "NodeJS"]
  },
  "createdAt": "2026-11-10T12:00:00.000Z",
  "updatedAt": "2026-11-10T12:00:00.000Z"
}
```

## Regras de negócio

1. **Ownership**: o `userId` vem sempre do JWT (`@CurrentUser()`). O service resolve o perfil do usuário e filtra todo recurso por `profile_id`. Nenhuma rota aceita `user_id`, `profile_id` ou `profileId` no body. Recurso de outro usuário responde **404**, nunca 403, para não revelar existência.
2. **Perfil 1:1 e upsert**: `profiles.user_id` é UNIQUE. `PATCH` cria o perfil na primeira chamada e atualiza nas seguintes; apenas os campos presentes no DTO são aplicados. `GET` não cria perfil e responde 404 enquanto ele não existir. Corrida de criação (`ER_DUP_ENTRY` em `user_id`) é tratada recarregando e atualizando.
3. **Perfil ausente em sub-recursos**: experiências, skills, formação, certificações e idiomas exigem perfil existente. Sem perfil, a operação responde 404 e não cria o perfil implicitamente; o cliente deve chamar `PATCH /v1/me/profile` primeiro.
4. **Campos opcionais do perfil**: string vazia normaliza para `null`; `null` explícito limpa o campo; campo ausente permanece inalterado. `currency` é ISO 4217 com três letras maiúsculas e default `BRL`. URLs exigem `http`/`https`. `availableFrom` é `YYYY-MM-DD`.
5. **Datas**: todo campo de data usa `YYYY-MM-DD`. `startDate` e `issueDate` são obrigatórias. `isCurrent=true` implica `endDate=null`; `isCurrent=false` exige `endDate` e `endDate >= startDate`. `expiryDate`, quando presente, deve ser `>= issueDate`; certificação já expirada é permitida. Comparações são feitas como data, nunca como texto.
6. **Experiências e bullets**: `sortOrder` default 0; ao criar sem ele, usar `MAX(sort_order) + 1` para evitar empate. Listagem por `sort_order ASC, start_date DESC`. Bullet tem `text` de até 500 caracteres e é validada contra a experiência antes de qualquer escrita. Apagar experiência remove bullets por `ON DELETE CASCADE`. Bullet de outra experiência responde 404.
7. **Skills do perfil**: `unique(profile_id, skill_id)`. Duplicar gera **409** (inclusive em corrida via `ER_DUP_ENTRY`); `skillId` inexistente gera **404**. `level` é obrigatório. `yearsExperience` vai de 0 a 99.9, com no máximo uma casa decimal. `lastUsedYear` não pode ser futuro. `skillId` é imutável no PATCH. Remover o vínculo não remove a skill do catálogo.
8. **Catálogo de skills**: somente leitura e povoado por seed do projeto. A busca normaliza `q` (trim, lowercase, sem acentos), pesquisa `name` e `aliases`, ordena por match exato > prefixo > contém e depois por nome, e aplica `limit` default 20 / máximo 50. `q` vazio lista as primeiras skills por nome.
9. **Idiomas**: o nome é persistido com trim; a checagem de duplicidade usa nome normalizado (trim + lowercase + remoção de acentos). Duplicado no mesmo perfil gera **409**. Não existe constraint UNIQUE no schema; a regra é do service e a corrida é um risco conhecido. Listagem por `name ASC`.
10. **Dinheiro**: sempre em centavos, inteiro `>= 0`, com `currency` de três letras. O MySQL devolve `bigint` como string; a resposta converte para número JSON e a persistência envia string. Nenhum cálculo monetário é feito nesta sprint.
11. **Enumerações**: `desiredSeniority`, `workModelPreference`, `employmentType`, `workModel`, `level`, `category` e `proficiency` usam os enums string da especificação, persistidos como `enum` do MySQL. Valor fora do enum → 400.
12. **Ordenação fixa**: experiências por `sortOrder` e `startDate DESC`; bullets por `sortOrder`; skills do perfil por categoria e nome da skill; formações por `startDate DESC`; certificações por `issueDate DESC`; idiomas por `name ASC`. Não há paginação nestas listas no MVP.
13. **Respostas**: criação 201, leitura/atualização 200, remoção 204 sem corpo. Nenhum DTO de resposta expõe dados de autenticação. Erros seguem o filtro global.

## Modelo de dados

Migration `1794268800000-CreateProfileDomain` (`synchronize: false`). Todas as PKs são
`varchar(36)` com UUID e todas as tabelas têm `created_at`/`updated_at` em `datetime(6)`.

| Tabela | Campos principais | Restrições e FKs |
|---|---|---|
| `profiles` | `id`, `user_id`, `headline varchar(160)`, `summary text`, `phone varchar(30)`, `city/state/country varchar(80)`, `linkedin_url/github_url/portfolio_url varchar(255)`, `desired_role varchar(160)`, `desired_seniority enum`, `work_model_preference enum`, `desired_salary_cents bigint`, `currency char(3) default 'BRL'`, `available_from date` | UNIQUE `user_id`; FK `user_id → users.id` `ON DELETE CASCADE` |
| `skills` | `id`, `name varchar(80)`, `slug varchar(80)`, `category enum`, `aliases json` | UNIQUE `name`, UNIQUE `slug`; catálogo somente leitura via API |
| `profile_skills` | `id`, `profile_id`, `skill_id`, `level enum`, `years_experience decimal(4,1)`, `last_used_year smallint` | UNIQUE `(profile_id, skill_id)`; FKs `profile_id → profiles.id` e `skill_id → skills.id`, ambas `ON DELETE CASCADE` |
| `experiences` | `id`, `profile_id`, `company_name varchar(160)`, `role varchar(160)`, `employment_type enum`, `work_model enum`, `location varchar(160) NULL`, `start_date date`, `end_date date NULL`, `is_current tinyint default 0`, `description text NULL`, `sort_order int default 0` | FK `profile_id → profiles.id` `ON DELETE CASCADE` |
| `experience_bullets` | `id`, `experience_id`, `text varchar(500)`, `sort_order int default 0` | FK `experience_id → experiences.id` `ON DELETE CASCADE` |
| `educations` | `id`, `profile_id`, `institution varchar(160)`, `degree varchar(160)`, `field_of_study varchar(160)`, `start_date date`, `end_date date NULL`, `is_current tinyint default 0`, `description text NULL` | FK `profile_id → profiles.id` `ON DELETE CASCADE` |
| `certifications` | `id`, `profile_id`, `name varchar(160)`, `issuer varchar(160)`, `issue_date date`, `expiry_date date NULL`, `credential_url varchar(255) NULL`, `credential_id varchar(120) NULL` | FK `profile_id → profiles.id` `ON DELETE CASCADE` |
| `languages` | `id`, `profile_id`, `name varchar(60)`, `proficiency enum` | FK `profile_id → profiles.id` `ON DELETE CASCADE`; sem UNIQUE em `(profile_id, name)` |

Cascatas: apagar um usuário remove o perfil; apagar o perfil remove experiências, bullets,
skills vinculadas, formações, certificações e idiomas. Apagar uma experiência remove suas
bullets. Apagar uma skill do catálogo removeria os vínculos, mas o catálogo não tem rota de
escrita.

## Estado da implementação

| Módulo | Estrutura | Regras de negócio | Testes |
|---|---|---|---|
| `profiles` | Pronta (entidade, DTOs, controller, module) | Implementadas (KAN-13) | Unitários e e2e verdes |
| `experiences` | Pronta (entidades, DTOs, controller, module) | Implementadas (KAN-14) | Unitários e e2e verdes |
| `skills` | Pronta (entidades, DTOs, controllers de catálogo e vínculo, module) | Implementadas (KAN-15) | Unitários e e2e verdes |
| `educations` | Pronta (entidade, DTOs, controller, module) | Implementadas (KAN-16) | Unitários e e2e verdes |
| `certifications` | Pronta (entidade, DTOs, controller, module) | Implementadas (KAN-16) | Unitários e e2e verdes |
| `languages` | Pronta (entidade, DTOs, controller, module) | Implementadas (KAN-16) | Unitários e e2e verdes |
| Migration `CreateProfileDomain` | Pronta e aplicada | — | `npm run migration:run` sem pendências |
| Seed do catálogo de skills | Criado (`npm run seed:skills`) | 118 skills e 84 aliases; idempotente; execução local e explícita, nunca em bootstrap/migration | Executado 2x com 118 skills; aliases obrigatórios conferidos no banco |

Os services (`ProfilesService`, `ExperiencesService`, `SkillsService`,
`EducationsService`, `CertificationsService`, `LanguagesService`) estão implementados e
não resta `NotImplementedException`/HTTP 501 nas rotas do domínio. As correções de
integração (`hasField` x `undefined` do `class-transformer` e `dateStrings: ['DATE']`)
foram aplicadas e registradas na [ADR 0002](../adr/0002-sprint-2-profile.md).

## Validação local (2026-11-18)

Branch `feat/sprint-2-profile`, HEAD `00b0647`, MySQL Docker local `kandid-mysql`.
Nada foi commitado ou enviado ao remoto; commit e push dependem de aprovação humana.

| Comando | Resultado |
|---|---|
| `npm run lint` | Exit 0; 1 warning preexistente em `test/auth.e2e-spec.ts:232` |
| `npx tsc --noEmit` | Exit 0 |
| `npm run build` | Exit 0 |
| `npm test` | 232/232 testes em 21 arquivos |
| `npm run test:e2e` | 192/192 testes em 6 arquivos |
| `npm run migration:run` | Sem pendências |
| `npm run seed:skills` | Executado 2x; 118 skills e 84 aliases; idempotente |

Os aliases obrigatórios da spec foram conferidos diretamente no banco. A suíte e2e
cobre KAN-13 a KAN-16, incluindo dois usuários, ownership (404 para recursos alheios),
401 sem token e os caminhos de 400/404/409 previstos nos critérios acima.

## Testes previstos e executados

Os cenários abaixo foram implementados e executados em 2026-11-18; consulte
[Validação local](#validação-local-2026-11-18) para os comandos e resultados.

| História | Unitários | E2E |
|---|---|---|
| KAN-13 | `profiles.service.spec.ts`: 404 sem perfil; upsert cria; segundo PATCH atualiza só campos enviados; null limpa; centavos ↔ bigint string; corrida `ER_DUP_ENTRY` recarrega | GET sem perfil 404 e sem criar; PATCH cria 200; PATCH atualiza; 400 para URL/currency/salário; 400 para campo desconhecido; 401 sem token; GET reflete persistência sem dados sensíveis |
| KAN-14 | `experiences.service.spec.ts`: ownership por `userId`; datas (current com endDate, não current sem endDate, endDate < startDate); sortOrder default; cascata de bullets; bullet de outra experiência 404; ordenação | CRUD completo; 400 de datas; 401; 404 de experiência de outro usuário; 404 sem perfil; bullet 201/400/404; DELETE 204 e bullets removidas; ordenação da lista |
| KAN-15 | `skills.service.spec.ts`: busca por nome e alias com prioridade; `q` vazio; limit; skill inexistente 404; duplicado 409 e `ER_DUP_ENTRY`; validação de anos/ano futuro; ownership do vínculo | `GET /v1/skills` com e sem `q`, 400 de limit; 401; POST 201; POST duplicado 409; skill inexistente 404; PATCH com skillId 400; PATCH/DELETE de outro usuário 404; DELETE 204 preserva catálogo |
| KAN-16 | `educations.service.spec.ts`, `certifications.service.spec.ts`, `languages.service.spec.ts`: ownership; datas de formação e certificação; duplicidade de idioma normalizada; ordenações | CRUD das três rotas; 400 de datas e enum; 409 de idioma duplicado com caixa/acento; 401; 404 de recurso de outro usuário e sem perfil; DELETE 204 |

Cenários transversais obrigatórios em todos os e2e:

- dois usuários distintos, cada um enxergando apenas os próprios recursos;
- tentativa de acesso por `:id` de outro usuário → 404;
- ausência/invalidez de token → 401;
- payload com `user_id`, `profile_id` ou `profileId` → 400;
- validação de datas em criação e em PATCH parcial.

## Riscos

| Risco | Mitigação |
|---|---|
| Divergência entre `date` string (`YYYY-MM-DD`) e `Date` do JavaScript, com deslocamento por fuso | Mitigação aplicada: comparação com `Date.UTC` em helpers puros e `extra: { dateStrings: ['DATE'] }` em `src/app.module.ts` e `src/database/data-source.ts`; `createdAt`/`updatedAt` continuam `Date`; ver ADR 0002 |
| `bigint` retornado como string pelo driver MySQL | Converter explicitamente no mapper de resposta e enviar string na persistência; teste com valor alto e com `null` |
| Duplicidade de skill em corrida | Constraint `unique(profile_id, skill_id)` + tradução de `ER_DUP_ENTRY` para 409, não 500 |
| Duplicidade de idioma em corrida | Não há UNIQUE no schema; validar no service e registrar a limitação. Se necessário, criar UNIQUE normalizado em migration futura |
| Perfil ausente confundido com perfil vazio | GET responde 404; PATCH é o único ponto de criação; sub-recursos não criam perfil implicitamente |
| Vazamento de recurso de outro usuário | Toda query parte do `userId` do JWT e filtra por `profile_id`; nunca buscar só por `:id`; 404 em vez de 403 |
| `NotImplementedException` esquecida e 501 em produção | Risco encerrado: nenhum 501 restante nos services; e2e das rotas do domínio verde |
| Campos `undefined` materializados pelo `class-transformer` (`enableImplicitConversion`) limpando campos não enviados no PATCH | Mitigação aplicada: `hasField` exige propriedade própria **e** valor diferente de `undefined`; `null` explícito continua limpando opcionais; ver ADR 0002 |
| Busca em `aliases` JSON com comportamento diferente entre versões do MySQL | Risco contornado: normalização e ranking em memória, exato > prefixo > contém, sem `JSON_SEARCH`; ver ADR 0002 |
| Seed do catálogo ausente ou incompleto | Risco mitigado: seed idempotente com 118 skills e 84 aliases, executado explicitamente (`npm run seed:skills`) e conferido no banco; nunca em bootstrap/migration |
| Ordenação instável por `sort_order` empatado | Default `MAX(sort_order)+1` na criação e ordenação secundária por data/nome |
| Listas sem paginação crescendo demais | Fora do MVP; monitorar volume de experiências/skills por perfil e avaliar paginação na Sprint 3+ |
| Validação de URL/currency rígida demais e quebra de clientes | Testes de DTO cobrindo `http`/`https` e ISO 4217; mensagens claras |
| `null` explícito em campo NOT NULL nos DTOs de update | Mitigado: `assertNoForcedNull` cobre `companyName`/`role`/`startDate`/`isCurrent`/`sortOrder` em experiências, `text`/`sortOrder` em bullets e `institution`/`degree`/`fieldOfStudy`/`startDate`/`isCurrent` em formações; testes unitários cobrem os caminhos 400 |
| Charset/collation divergente nas tabelas novas | Migration fixa `utf8mb4` / `utf8mb4_0900_ai_ci`; validar a FK `profiles.user_id → users.id` em banco limpo |
| Migration aplicada em banco local já existente | Migration versionada e forward-only; `synchronize: false`; rodar `migration:run` e verificar ausência de drift |

## Definition of Done

Estrutura e fundação (comprovado desde o início da sprint):

- [x] Estruturas de `profiles`, `experiences`, `skills`, `educations`, `certifications` e `languages` criadas (entidades, DTOs, controllers, modules) e registradas no `AppModule`.
- [x] `npm run build` verde.
- [x] `npx tsc --noEmit` verde.
- [x] Suíte da Sprint 1 verde: 8 arquivos e 50 testes unitários; 2 arquivos e 28 testes e2e.
- [x] Migration `1794268800000-CreateProfileDomain` aplicada via `npm run migration:run`.
- [x] `synchronize: false` mantido, sem drift entre entidades e migration.
- [x] Validação estrita de datas `YYYY-MM-DD` e URLs `http`/`https` nos DTOs, verificada em runtime (400 para hora, data inexistente, URL sem protocolo e `ftp`).
- [x] Migration fixa `utf8mb4`/`utf8mb4_0900_ai_ci` e `desired_salary_cents` como `bigint unsigned`; migration reaplicada sem drift.
- [x] `Repository<Profile>` injetado nos services que dependem do perfil (`experiences`, `skills`, `educations`, `certifications`, `languages`).

Regras de negócio e validação (comprovado em 2026-11-18):

- [x] `ProfilesService` implementado (GET 404 sem perfil, PATCH com upsert e retry único em `ER_DUP_ENTRY` de `user_id`).
- [x] `ExperiencesService` implementado (CRUD, bullets, ownership, datas e `sortOrder` default `MAX+1`).
- [x] `SkillsService` implementado (busca normalizada em memória e CRUD de vínculos com 409/404).
- [x] `EducationsService`, `CertificationsService` e `LanguagesService` implementados.
- [x] Seed do catálogo de skills criado com os aliases exigidos pela especificação (118 skills e 84 aliases, idempotente).
- [x] Nenhum `NotImplementedException` restante nos services.
- [x] Testes unitários por service cobrindo ownership, datas, duplicidade e conversões (232/232 em 21 arquivos).
- [x] Testes e2e de KAN-13 a KAN-16 cobrindo caminho feliz, 400, 401, 404 e 409 (192/192 em 6 arquivos, MySQL local).
- [x] Swagger com exemplos de request/response nas rotas do domínio.
- [x] `npm run lint` exit 0, com 1 warning preexistente em `test/auth.e2e-spec.ts:232`.
- [x] `npm test` e `npm run test:e2e` verdes com os novos arquivos, e2e com MySQL local.
- [x] Correções de integração aplicadas: `hasField` ignora `undefined` e `dateStrings: ['DATE']` preserva `YYYY-MM-DD` (ADR 0002).
- [x] Critérios de aceite de KAN-13, KAN-14, KAN-15 e KAN-16 verificados.
- [x] `docs/backlog.md`, `README.md`, esta sprint e a ADR 0002 atualizados ao final.

Portões externos (não concluídos nesta branch):

- [ ] Revisão humana aprovada e CI verde no PR.

O DoD técnico foi atendido localmente na branch `feat/sprint-2-profile` (HEAD `00b0647`).
Não houve commit, push, PR, merge nem deploy; esses portões continuam pendentes de
aprovação humana. Os workflows de CD e Dependabot seguem ativos e sem alteração, como
pendência registrada.

## Tarefas

- [x] Implementar `ProfilesService.getProfile`: buscar por `userId`, 404 quando ausente e mapper de resposta.
- [x] Implementar `ProfilesService.updateProfile`: upsert, aplicar só campos enviados, normalizar vazios, converter centavos e tratar `ER_DUP_ENTRY`.
- [x] Escrever `profiles.service.spec.ts`.
- [x] Implementar `ExperiencesService.create/findAll/findOne/update/remove` com ownership, datas e ordenação.
- [x] Implementar `ExperiencesService.addBullet/updateBullet/removeBullet` validando a experiência antes da bullet.
- [x] Escrever `experiences.service.spec.ts`.
- [x] Implementar `SkillsService.search` com normalização, aliases, relevância e `limit`.
- [x] Criar o seed do catálogo de skills com os aliases obrigatórios.
- [x] Implementar `SkillsService.listProfileSkills/addProfileSkill/updateProfileSkill/removeProfileSkill` com 409/404 e conversão de decimal.
- [x] Escrever `skills.service.spec.ts`.
- [x] Implementar `EducationsService` com ownership, regras de data e ordenação.
- [x] Implementar `CertificationsService` com ownership, regras de data e ordenação.
- [x] Implementar `LanguagesService` com ownership, normalização de nome, 409 de duplicidade e ordenação.
- [x] Escrever `educations.service.spec.ts`, `certifications.service.spec.ts` e `languages.service.spec.ts`.
- [x] Escrever os e2e de KAN-13, KAN-14, KAN-15 e KAN-16, incluindo dois usuários e casos de ownership.
- [x] Completar exemplos de request/response no Swagger das rotas do domínio.
- [x] Corrigir `hasField` para ignorar `undefined` materializado pelo `class-transformer` e preservar PATCH parcial.
- [x] Configurar `extra: { dateStrings: ['DATE'] }` em `src/app.module.ts` e `src/database/data-source.ts`.
- [x] Rejeitar `null` explícito em colunas NOT NULL omitidas pelo `assertNoForcedNull` (`isCurrent`/`sortOrder` em experiências e bullets, `isCurrent` em formações).
- [x] Restringir a tradução de `ER_DUP_ENTRY` de skills à constraint `UQ_profile_skills_profile_skill`.
- [x] Usar `expiryDate` na mensagem de erro de ordem de datas de certificações.
- [x] Rodar `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` e `npm run test:e2e`; corrigir falhas.
- [x] Rodar `npm run migration:run` e confirmar ausência de drift; executar `npm run seed:skills` 2x e conferir aliases no banco.
- [x] Atualizar `docs/backlog.md`, esta sprint, o README e a ADR 0002 com o estado final.
