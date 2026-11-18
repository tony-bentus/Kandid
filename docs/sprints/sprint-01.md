# Sprint 1 — Autenticação

- Status: Em andamento
- Início: 2026-11-09
- Encerramento: quando o Definition of Done for atingido

## Objetivo

Entregar a base de identidade da API: cadastro de usuário, login com JWT e consulta
do usuário autenticado. Ao final da sprint, é possível registrar uma conta, obter um
token de acesso e usá-lo para acessar `GET /v1/auth/me`, com senhas protegidas por
Argon2id e erros padronizados.

## Escopo

### Histórias

| ID | História |
|---|---|
| KAN-10 | Registrar usuário |
| KAN-11 | Autenticar com JWT |
| KAN-12 | Consultar usuário autenticado |

Dependência: a sprint assume a fundação da Sprint 0 (configuração validada, TypeORM
com `synchronize: false`, filtro de erros global, Swagger e prefixo `/v1`).

### Fora de escopo

- Refresh token, revogação de token e logout.
- Verificação de e-mail, recuperação e troca de senha.
- Roles, permissões e OAuth/social login.
- Endpoint de exclusão de usuário (o soft delete existe apenas no modelo).
- Perfil profissional (KAN-13 em diante) e qualquer entidade de domínio além de `users`.
- Rate limiting e bloqueio por tentativas de login.

## Critérios de aceite

### KAN-10 — Registrar usuário

- Dado que envio `name`, `email` e `password` válidos, quando chamo `POST /v1/auth/register`, então recebo 201 com `{ user, accessToken }`.
- Dado que envio e-mail com letras maiúsculas ou espaços nas pontas, quando registro, então o e-mail é normalizado para lowercase sem espaços e persistido assim.
- Dado que já existe um usuário com o mesmo e-mail, quando registro novamente, então recebo 409 com mensagem clara e nenhum novo usuário é criado.
- Dado que envio payload sem `name`, com e-mail malformado ou com senha fora do intervalo de 8 a 128 caracteres, quando registro, então recebo 400 com mensagem indicando o campo inválido.
- Dado um registro bem-sucedido, quando inspeciono a resposta e o banco, então a senha não aparece em texto puro em nenhum dos dois e `password_hash` não está na resposta.
- Dado um registro bem-sucedido, quando verifico o `accessToken` retornado, então ele é um JWT válido com `sub` igual ao `id` do usuário e `email` normalizado.

### KAN-11 — Autenticar com JWT

- Dado que envio e-mail e senha de um usuário existente, quando chamo `POST /v1/auth/login`, então recebo 200 com `{ user, accessToken }`.
- Dado que envio o e-mail em caixa diferente da cadastrada, quando faço login, então a autenticação funciona pela normalização do e-mail.
- Dado que envio senha incorreta, quando faço login, então recebo 401 com mensagem genérica.
- Dado que envio e-mail inexistente, quando faço login, então recebo 401 com status, mensagem e corpo idênticos ao caso de senha incorreta.
- Dado que envio payload sem `email` ou sem `password`, quando faço login, então recebo 400 com mensagem de validação.
- Dado um login bem-sucedido, quando decodifico o token, então `exp - iat` é de 3600 segundos e a resposta não contém `password_hash`.

### KAN-12 — Consultar usuário autenticado

- Dado que envio um Bearer token válido, quando chamo `GET /v1/auth/me`, então recebo 200 com `id`, `name`, `email`, `createdAt` e `updatedAt` do usuário do token.
- Dado que não envio o header `Authorization`, quando chamo `GET /v1/auth/me`, então recebo 401.
- Dado que envio token com assinatura inválida, expirado ou malformado, quando chamo `GET /v1/auth/me`, então recebo 401 sem detalhes internos.
- Dado um token cujo usuário foi marcado com `deleted_at`, quando chamo `GET /v1/auth/me`, então recebo 401.
- Dado qualquer resposta de `GET /v1/auth/me`, então o corpo nunca inclui `password_hash`.
- Dado que envio token válido, quando o `sub` não corresponde a nenhum usuário, então recebo 401.

## Contratos

| Método | Rota | Autenticação | Request | Sucesso | Erros |
|---|---|---|---|---|---|
| POST | `/v1/auth/register` | Pública | `{ name, email, password }` | 201 `{ user, accessToken }` | 400, 409 |
| POST | `/v1/auth/login` | Pública | `{ email, password }` | 200 `{ user, accessToken }` | 400, 401 |
| GET | `/v1/auth/me` | Bearer JWT | — | 200 `{ id, name, email, createdAt, updatedAt }` | 401 |

Erros seguem o formato único `{ statusCode, error, message, path, timestamp }`.

Request de register:

```json
{
  "name": "Ana Souza",
  "email": "ana.souza@example.com",
  "password": "senha-segura-123"
}
```

Resposta de register (201):

```json
{
  "user": {
    "id": "6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33",
    "name": "Ana Souza",
    "email": "ana.souza@example.com",
    "createdAt": "2026-11-09T13:20:41.000Z",
    "updatedAt": "2026-11-09T13:20:41.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Request de login:

```json
{
  "email": "ana.souza@example.com",
  "password": "senha-segura-123"
}
```

Resposta de login (200): mesmo envelope `{ user, accessToken }` do register.

Exemplo de erro 401 de login:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid email or password",
  "path": "/v1/auth/login",
  "timestamp": "2026-11-09T13:21:02.000Z"
}
```

## Regras de negócio

1. **Normalização de e-mail**: aplicar `trim` e lowercase antes de validar, persistir e buscar. O e-mail retornado na API é sempre o normalizado.
2. **Unicidade de e-mail**: garantida por constraint `unique` em `users.email`; a violação é traduzida para 409, nunca para 500.
3. **Senha**: 8 a 128 caracteres, sem exigência de complexidade. Persistida apenas como hash Argon2id em `password_hash`; nunca logada, nunca retornada.
4. **JWT**: assinatura HS256, expiração de 1h, payload com `sub` (id do usuário) e `email`. `JWT_SECRET` é obrigatório e deve ter no mínimo 16 caracteres, validado no boot.
5. **Login**: comparação de senha via verificação Argon2id. E-mail inexistente e senha incorreta retornam exatamente a mesma resposta 401 (`Invalid email or password`), sem revelar qual campo falhou.
6. **Escopo do `/me`**: identidade vem exclusivamente do token (`sub`). Nenhum `id` ou `user_id` é aceito por body, query ou param. Usuário inexistente ou com `deleted_at` preenchido é rejeitado com 401.
7. **Serialização**: o DTO de saída de usuário expõe apenas `id`, `name`, `email`, `createdAt` e `updatedAt`; `password_hash` é excluído por design, não por filtro ad hoc.
8. **Soft delete**: `users.deleted_at` existe no modelo, mas não há endpoint de exclusão no MVP. Usuários com `deleted_at` não autenticam nem são retornados pelo `/me`.
9. **Erros**: todas as respostas de erro seguem `{ statusCode, error, message, path, timestamp }` pelo filtro global.

## Modelo de dados

Tabela `users` (plural, para evitar a palavra reservada `user`):

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | `uuid` | PK, `@PrimaryGeneratedColumn('uuid')` |
| `name` | `varchar(120)` | NOT NULL |
| `email` | `varchar(160)` | NOT NULL, UNIQUE |
| `password_hash` | `varchar(255)` | NOT NULL |
| `created_at` | `datetime(6)` | NOT NULL, UTC, default now |
| `updated_at` | `datetime(6)` | NOT NULL, UTC, atualizado em cada escrita |
| `deleted_at` | `datetime(6)` | NULL, default NULL |

Notas:

- `synchronize: false`; a tabela nasce por migration versionada.
- Sem FK nesta sprint: nenhuma outra entidade existe ainda.
- O índice único de `email` é a única garantia de unicidade; nenhuma checagem apenas em memória é suficiente.

## Testes implementados

**Unitários** — 8 arquivos, 50 testes:

- `auth.service.spec.ts`: registro normaliza o e-mail, gera hash Argon2id, persiste e devolve token; e-mail duplicado e corrida com `ER_DUP_ENTRY` viram 409; login válido devolve token; senha errada e e-mail inexistente devolvem 401 com a mesma mensagem; `getCurrentUser` aceita usuário existente e rejeita usuário removido.
- `users.service.spec.ts`: busca e criação normalizam o e-mail; busca por id funciona e e-mail ausente retorna `null`.
- `jwt-auth.guard.spec.ts`: header ausente, scheme diferente de `Bearer`, header malformado, token inválido, token expirado e token sem claims resultam em 401; token válido popula `request.user`.
- `auth.dto.spec.ts`: `RegisterDto` e `LoginDto` normalizam o e-mail, aplicam os limites de `name` e `password` e rejeitam campos ausentes ou malformados. Não existe arquivo isolado de normalização; o comportamento é coberto nos testes de DTO, `UsersService` e `AuthService`.
- `app.controller.spec.ts`, `health.controller.spec.ts`, `env.validation.spec.ts` e `all-exceptions.filter.spec.ts`: suítes da fundação mantidas.

**E2E** — 2 arquivos, 28 testes:

- `auth.e2e-spec.ts`:
  - register válido → 201 com `user` e `accessToken`, sem `password_hash`;
  - register com e-mail duplicado → 409, inclusive em outra caixa e em corrida;
  - register com payload inválido (sem nome, nome de 1 caractere, e-mail malformado, senha com 7 e 129 caracteres) e campo desconhecido → 400;
  - e-mail em caixa mista é normalizado e autentica em lowercase;
  - login válido → 200 com `user` e `accessToken`, com `exp - iat = 3600`;
  - login com senha errada e com e-mail inexistente → 401 com o mesmo corpo;
  - `GET /v1/auth/me` com Bearer válido → 200 com os cinco campos esperados;
  - `/me` sem header, com token inválido, expirado ou com `sub` inexistente → 401;
  - usuário com `deleted_at` não autentica no `/me` nem no login.
- `app.e2e-spec.ts`: metadados, health e formato padrão de erro.

## Riscos

| Risco | Mitigação |
|---|---|
| Argon2id lento e e2e estourando timeout | custo fixo em todos os ambientes (m=19456, t=2, p=1), sem redução por ambiente; a suíte local roda em ~2,5 s. Se o CI ficar lento, ajustar timeout de teste, não o custo de segurança |
| Vazamento de hash ou senha em log | nunca logar body de auth; interceptor/logger sem payload sensível; revisão no code review |
| Token sem expiração ou com segredo fraco | `expiresIn: '1h'` fixo e `JWT_SECRET` validado no boot com mínimo de 16 caracteres |
| Enumeração de usuários pelo login | mesma mensagem, mesmo status e mesmo corpo para e-mail inexistente e senha errada |
| Duplicidade de e-mail por diferença de caixa | normalização antes de validar/persistir + constraint `unique` no banco |
| Resposta expondo `password_hash` | DTO de saída dedicado e teste e2e que falha se o campo aparecer |
| Migration em banco local já existente | migration forward-only e `migration:run` documentado; nada de `synchronize: true` |
| Guard JWT esquecido em rotas futuras | guard aplicado por padrão no controller de auth e decorator explícito para rotas públicas |
| Divergência entre `/v1/auth/me` e o futuro `/v1/me/profile` | `/me` desta sprint retorna apenas o usuário; perfil fica na Sprint 2 |

## Definition of Done

- [x] Lint local via fallback (`npx oxlint src/ test/` + `npx tsc --noEmit`) verde.
- [ ] `npm run lint` completo (type-aware) nesta máquina — bloqueado pelo AppLocker/WDAC ao executar `@oxlint-tsgolint/win32-x64/tsgolint.exe`; o job de CI em Ubuntu executa o comando completo.
- [x] `npm run build` verde.
- [x] `npm test` verde, com 8 arquivos e 50 testes.
- [x] `npm run test:e2e` verde, com 2 arquivos e 28 testes cobrindo register, login, `/me`, 400, 401 e 409.
- [x] Migration `1794182400000-CreateUsers` criada e aplicada via `npm run migration:run`.
- [x] `synchronize: false` mantido e nenhuma alteração de schema fora da migration.
- [x] Swagger em `/docs` documentando as três rotas, os DTOs e o Bearer auth.
- [x] `JWT_SECRET` documentado em `.env.example` e validado no boot.
- [x] Nenhuma resposta ou log expõe `password_hash`.
- [x] Critérios de aceite de KAN-10, KAN-11 e KAN-12 verificados.
- [x] `docs/backlog.md` com KAN-10, KAN-11 e KAN-12 atualizados após a entrega.
- [x] README com exemplos `curl` de register, login e `/me`.
- [ ] Revisão humana aprovada e CI verde no PR.

> **Bloqueio de ambiente:** nesta máquina Windows, `npm run lint`
> (`oxlint --type-aware`) falha antes de analisar o código porque o
> AppLocker/WDAC impede a execução de `tsgolint.exe`. O fallback
> `npx oxlint src/ test/` + `npx tsc --noEmit` foi executado com sucesso; o CI
> em Ubuntu roda o comando completo.

## Tarefas

- [x] Criar a entidade `User` mapeada para a tabela `users` (`id`, `name`, `email`, `password_hash`, timestamps, `deleted_at`).
- [x] Gerar e revisar a migration de `users` com `unique` em `email`.
- [x] Implementar o hash Argon2id com parâmetros fixos (m=19456, t=2, p=1).
- [x] Implementar `normalizeEmail` (trim + lowercase) e usá-lo em DTOs, serviços e buscas.
- [x] Criar os DTOs de entrada com `class-validator` (name, email, password) e o DTO de saída de usuário sem `password_hash`.
- [x] Implementar `AuthService.register`: normalizar, verificar duplicidade, hashear, persistir e emitir token; traduzir violação de unique em 409.
- [x] Implementar `AuthService.login`: buscar por e-mail normalizado, verificar hash com Argon2id e lançar 401 genérico em qualquer falha.
- [x] Implementar `AuthService.getCurrentUser` e a validação de usuário existente e não deletado.
- [x] Configurar `JwtModule` com `JWT_SECRET` validado e `expiresIn: '1h'`, payload `{ sub, email }`.
- [x] Implementar `JwtAuthGuard` sem passport, aplicando o guard em `GET /v1/auth/me`.
- [x] Criar `AuthController` com `POST /v1/auth/register`, `POST /v1/auth/login` e `GET /v1/auth/me`.
- [x] Documentar as rotas, DTOs, respostas de erro e o Bearer auth no Swagger.
- [x] Escrever os testes unitários de `auth.service`, `users.service`, `jwt-auth.guard` e `auth.dto`.
- [x] Escrever o e2e de auth cobrindo caminhos felizes, 400, 401, 409 e corrida de duplicidade.
- [x] Rodar build, testes unitários e e2e; corrigir falhas.
- [x] Rodar lint via fallback (`npx oxlint src/ test/` + `npx tsc --noEmit`).
- [ ] Rodar `npm run lint` type-aware nesta máquina (bloqueio de AppLocker; o CI cobre).
- [x] Atualizar `docs/backlog.md` e o README com os exemplos de uso.

## Validação (2026-11-09)

| Verificação | Resultado |
|---|---|
| `npm run build` | verde |
| `npm test` | 8 arquivos, 50 testes |
| `npm run test:e2e` | 2 arquivos, 28 testes, com MySQL local via Docker e migration aplicada |
| `npx oxlint src/ test/` | verde |
| `npx tsc --noEmit` | verde |
| `npm run lint` | bloqueado nesta máquina por AppLocker/WDAC em `tsgolint.exe`; o CI em Ubuntu executa o comando completo |
| `npm run migration:run` | aplica `1794182400000-CreateUsers` |
| Smoke test | `/v1/health` 200 com `database: up`, `/docs` 200, register/login/me funcionando e `/me` sem token 401 |
