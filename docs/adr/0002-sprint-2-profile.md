# ADR 0002 — Busca, conversão de tipos e erros de integridade no domínio de perfil

- Status: Accepted
- Data: 2026-11-18
- Decisores: Antônio + time Kandid (parecer do architect na Sprint 2)

## Contexto

A Sprint 2 implementa as regras de negócio do perfil profissional sobre o scaffold já
criado (`docs/sprints/sprint-02.md:320-338`). A spec exige autocomplete de skills com
normalização de `q`, busca em `name` e `aliases` e relevância exato > prefixo > contém
(`docs/prompt-kandid.md:503-504`, `docs/sprints/sprint-02.md:74`, `:292`). O catálogo é
somente leitura e semeado pelo projeto, com no mínimo 80 skills (`docs/prompt-kandid.md:503`,
`:555`), e a migration `1794268800000-CreateProfileDomain` já define `utf8mb4` /
`utf8mb4_0900_ai_ci`, `aliases json`, `bigint unsigned`, `decimal(4,1)` e as constraints
de unicidade (`src/database/migrations/1794268800000-CreateProfileDomain.ts:31`, `:36`,
`:50-53`, `:66`).

Três pontos do parecer precisam de registro formal antes da implementação:

1. **Busca:** `skills.aliases` é JSON, e o comportamento de `JSON_SEARCH` depende da
   collation/binária do MySQL 8; a ordenação por relevância exigida não é trivial em SQL.
2. **Tipos:** o driver `mysql2` devolve `bigint` e `decimal` como string; datas `date`
   são strings `YYYY-MM-DD` e comparações ingênuas com `new Date()` sofrem deslocamento
   de fuso (`docs/sprints/sprint-02.md:361-362`).
3. **Concorrência:** `unique(user_id)` em `profiles` e `unique(profile_id, skill_id)` em
   `profile_skills` podem lançar `ER_DUP_ENTRY` em corrida, com tratamentos diferentes
   exigidos pela sprint (recarga no upsert do perfil e 409 no vínculo de skill)
   (`docs/sprints/sprint-02.md:286`, `:291`, `:363`).

Restrições: TypeScript strict, ESM com imports `.js`, `synchronize: false`, migrations
versionadas e nenhuma escrita de catálogo pela API (`AGENTS.md:60-69`).

## Decisão

### 2 — Busca de skills normalizada em memória

`SkillsService.search` carrega o catálogo com `skillsRepository.find({ order: { name: 'ASC' } })`
e ranqueia em JavaScript puro:

- normalização `trim → lowercase → NFD → remover marcas Unicode (\p{M})`;
- `q` vazio lista as primeiras skills por nome;
- relevância por skill = menor rank entre `name` e `aliases`: `0` exato, `1` prefixo,
  `2` contém, `Infinity` sem match; ordenação final `(rank, nome normalizado, id)`;
- `limit` default 20, máximo 50, já validado em `search-skills-query.dto.ts:26-31`.

### 3 — Helpers puros em `src/common/utils/`

Criar helpers sem dependência de Nest/TypeORM, testáveis por unit test:

| Arquivo | Contrato |
|---|---|
| `money.ts` | `bigintCentsToNumber(raw: string \| null)`: `null → null`; converte via `BigInt(raw)` somente se `<= BigInt(Number.MAX_SAFE_INTEGER)`; `numberToBigintCents(value: number \| null)`: valida inteiro `>= 0` e devolve `String(value)`. |
| `decimal.ts` | `decimalToNumber(raw: string \| null)` para `yearsExperience`; persistência com `value.toFixed(1)` para casar com `decimal(4,1)`. |
| `dates.ts` | `dateOnlyToUtcMs(value)` usa `Date.UTC(y, m - 1, d)` com componentes extraídos de `YYYY-MM-DD`; `assertDateOrder(start, end)` compara os números. **Nunca** `new Date('YYYY-MM-DD')` nem comparação de datas como texto. |
| `normalize.ts` | `normalizeText(value)`: trim, lowercase, NFD, remoção de `\p{M}` — mesma normalização da busca e da checagem de idiomas. |
| `null-fields.ts` | `hasField` exige `hasOwnProperty` **e** valor diferente de `undefined`, para distinguir campo não enviado de `null` explícito; `null` em coluna NOT NULL → `400`. |
| `is-duplicate-entry.ts` | `isDuplicateEntry(error, constraintFragment)`: exige `QueryFailedError`, `driverError.code === 'ER_DUP_ENTRY'` **e** nome da constraint esperada na mensagem. |

Esses helpers são a única via de conversão nos mappers de resposta e antes de `save()`.
A conversão de `bigint` fora da faixa segura não é silenciosa: o helper falha em vez de
devolver um número corrompido.

### 4 — Campos `undefined` e datas `YYYY-MM-DD` (ajuste de integração)

Duas correções descobertas na integração e2e, após os services estarem implementados:

1. **`hasField` ignora `undefined`.** O `ValidationPipe` global usa
   `enableImplicitConversion: true` (`src/main.ts:17-19`). O `class-transformer`
   materializa todas as propriedades declaradas no DTO com valor `undefined`, mesmo
   quando o cliente não as enviou. Com `hasOwnProperty` puro, um PATCH com apenas
   `headline` limpava `summary`, `city`, `state`, `desiredRole`, `desiredSalaryCents`
   etc. Agora `hasField(dto, field)` requer propriedade própria **e** valor diferente
   de `undefined`; `null` continua presente e limpa colunas anuláveis. Não removemos
   `enableImplicitConversion` porque a conversão de query params (ex.: `limit`) depende
   dela.
2. **`extra: { dateStrings: ['DATE'] }` no MySQL.** Com `timezone: 'Z'`, o `mysql2`
   devolve `DATE` como `Date` em UTC (`2023-01-01T00:00:00.000Z`), e o TypeORM o
   reformata com `DateUtils.mixedDateToDateString` no fuso do processo
   (`America/Sao_Paulo` na máquina local), produzindo `2022-12-31`. Pedir ao driver para
   devolver somente `DATE` como string preserva `YYYY-MM-DD` em qualquer fuso, sem
   alterar `DATETIME` (`createdAt`/`updatedAt` continuam `Date`). Aplicado em
   `src/app.module.ts` e `src/database/data-source.ts`.

Essas duas correções são centrais: qualquer service que aplica PATCH usa `hasField`,
e todas as entidades com `start_date`, `end_date`, `issue_date`, `expiry_date` e
`available_from` dependem da leitura de datas sem deslocamento.

### 6 — Tradução seletiva de `ER_DUP_ENTRY`

| Situação | Comportamento |
|---|---|
| `ER_DUP_ENTRY` em `UQ_profile_skills_profile_skill` (`profile-skill.entity.ts:26-28`, migration `:66`) | `409 Conflict` e nenhum vínculo duplicado gravado (`docs/sprints/sprint-02.md:291`). |
| `ER_DUP_ENTRY` em `REL_9e432b7df0d182f8d292902d1a` / `user_id` (migration `:36`) | recarregar o perfil por `userId` e reaplicar o patch, com **no máximo 1 retry**; se repetir, propagar erro (`docs/sprints/sprint-02.md:286`). |
| Qualquer outro `QueryFailedError` (`ER_NO_REFERENCED_ROW_2`, `ER_DATA_TOO_LONG`, `ER_LOCK_WAIT_TIMEOUT`, `ER_DUP_ENTRY` de constraint alheia etc.) | permanece `500`; o filtro global já esconde detalhes de SQL/host (`all-exceptions.filter.ts:54-64`). |

A checagem de skill inexistente é explícita (`existsBy({ id: skillId }) → 404`) e não
depende de erro de FK (`docs/sprints/sprint-02.md:80`).

## Alternativas consideradas

### Para a busca

| Alternativa | Prós | Contras |
|---|---|---|
| **Catálogo em memória + ranking em JS** (escolhida) | determinístico e testável sem banco; normalização idêntica à dos DTOs; relevância simples de implementar; uma única query ordenada | varre o catálogo inteiro por request; lógica de normalização precisa ser mantida em sincronia com o normalizador do ATS na Fase 3 |
| `JSON_SEARCH` + `LOWER(name) LIKE` no MySQL 8 | sem carregar registros; usar índice `UQ_skills_name` em consultas simples | strings JSON usam collation binária no MySQL 8 (não herdam `utf8mb4_0900_ai_ci`); exige escape de `%`/`_` do usuário; `LOWER(name)` anula o índice; rankings exato/prefixo/contém exigem `CASE` complexo; resultado difícil de reproduzir em teste unitário |
| Tabela `skill_aliases` normalizada + FULLTEXT | índice e escala para catálogo grande | exige nova migration e mais uma entidade, fora do escopo da Sprint 2 (`docs/sprints/sprint-02.md:31-41`) |

### Para tipos e datas

| Alternativa | Prós | Contras |
|---|---|---|
| **Helpers puros + checagens explícitas** (escolhida) | conversão auditável, testes com valores-limite, sem surpresa do driver | mais arquivos e testes no P0 |
| Confiar no `enableImplicitConversion` / `Number()` direto no mapper | menos código | perde precisão acima de `MAX_SAFE_INTEGER`; `null` e decimal são tratados de forma inconsistente |
| `new Date(value)` para comparar datas | sintaxe curta | interpretação dependente de fuso/ambiente; a sprint exige comparação como data (`docs/sprints/sprint-02.md:289`, `:361`) |

### Para erros de integridade

| Alternativa | Prós | Contras |
|---|---|---|
| **Traduzir só `ER_DUP_ENTRY` com constraint conhecida** (escolhida) | 409/recarga previsíveis; demais falhas continuam 500 com log | acoplamento ao nome da constraint da migration |
| Traduzir todo `QueryFailedError` para 409/404 | implementação curta | erro de FK, tamanho ou lock viraria conflito enganoso; esconderia bugs de dados |
| Recarregar em loop até conseguir o upsert | eventualmente converte | risco de loop infinito e conexão presa; critério de saída indefinido |

## Critérios de avaliação

1. Busca com `q ∈ {NODE, nodejs, postgres, k8s, JS, C#, .NET, CPP}` reproduz os 8 aliases
   obrigatórios (`docs/prompt-kandid.md:96-97`) na mesma ordem em teste unitário (sem banco)
   e em e2e contra o MySQL 8 do Docker/CI; exato > prefixo > contém e `limit` 20/50
   verificados (`docs/sprints/sprint-02.md:74-76`).
2. Nenhuma query de busca usa `JSON_SEARCH`, `LOWER(name) LIKE` ou `%`/`_` sem escape;
   o teste unitário de ranking não inicializa `DataSource`.
3. Helpers cobrem `null`, valor alto (> `MAX_SAFE_INTEGER` não convertido silenciosamente),
   `5.5 → "5.5"`, e a mesma comparação de datas com `TZ=UTC` e `TZ=America/Sao_Paulo`.
4. Testes de `isDuplicateEntry` cobrem: constraint de `profile_skills` → 409; constraint de
   `profiles.user_id` → recarga com exatamente 1 retry; `ER_DUP_ENTRY` de outra constraint →
   500; `ER_LOCK_WAIT_TIMEOUT` → 500.
5. Nenhum `QueryFailedError` sem `ER_DUP_ENTRY` é mapeado para 4xx.

## Spike opcional

Tempo máximo: 30 minutos. Só se o time quiser comparar a alternativa SQL antes de fechar
a decisão: executar a mesma lista de `q` do critério 1 com `JSON_SEARCH`/`LIKE` no MySQL 8.
Critério de saída: adotar SQL apenas se reproduzir exatamente a ordem da implementação em
memória **e** o `EXPLAIN` mostrar uso de índice; caso contrário, manter a decisão 2.

## Consequências

### Positivas

- Busca determinística, independente de collation e reproduzível em unit test sem banco.
- Contrato de resposta estável: `number | null` para centavos e anos de experiência,
  `YYYY-MM-DD` para datas, sem deslocamento de fuso.
- Erros de integridade com significado previsível: 409 apenas para a constraint esperada,
  500 para falhas reais de banco, sem vazar SQL ao cliente.
- Helpers compartilhados evitam duplicação de conversão entre os 6 services da sprint.

### Negativas / trade-offs

- Leitura completa do catálogo por request de busca: hoje aceitável (~100 skills), mas
  não escala indefinidamente.
- Normalização da Sprint 2 (`trim/lower/NFD/sem marcas`) é mais simples que a
  canonicalização de símbolos do ATS (`c++ → cpp`, `c# → csharp`, `.net → dotnet`,
  `node.js → nodejs`, `ci/cd → cicd`, `docs/prompt-kandid.md:209-216`); as duas regras
  precisam ficar explicitamente separadas para não divergir.
- Tradução de erro depende dos nomes de constraints da migration atual; renomear um
  índice exige atualizar `is-duplicate-entry.ts` e esta ADR.
- `MAX_SAFE_INTEGER` limita a faixa representável pelo contrato `number` da resposta;
  valores maiores exigiriam mudança de contrato (fora desta sprint).

### Riscos residuais

- **Catálogo crescendo:** se passar de alguns milhares de skills, reavaliar
  `skill_aliases` com índice FULLTEXT; não é necessário agora.
- **Precisão numérica:** `bigint` acima de `Number.MAX_SAFE_INTEGER` falha no helper em
  vez de ser arredondado; monitorar se a pretensão salarial alcançar essa faixa.
- **Fora do alcance desta ADR:** a ausência de `UNIQUE` em `languages` e a duplicidade
  de idioma em corrida permanecem como risco conhecido registrado em
  `docs/sprints/sprint-02.md:293`, `:364`, sem alteração de schema aqui.

### Ações decorrentes

- [x] Criar os helpers em `src/common/utils/` com seus `.spec.ts` antes dos services.
- [x] Implementar `SkillsService.search` com ranking em memória e os aliases obrigatórios.
- [x] Usar os helpers nos mappers de `Profile`, `ProfileSkill` e nas validações de data.
- [x] Implementar `isDuplicateEntry` e os dois caminhos de recarga/409 nos services.
- [x] Correções de integração aplicadas: `hasField` ignora o `undefined` materializado pelo `class-transformer` (`enableImplicitConversion`) para não limpar campos não enviados no PATCH; `extra: { dateStrings: ['DATE'] }` em `src/app.module.ts` e `src/database/data-source.ts` preserva `YYYY-MM-DD` em qualquer fuso (`createdAt`/`updatedAt` continuam `Date`). Detalhes na Decisão 4.
- [x] Correções da revisão final aplicadas: `assertNoForcedNull` também cobre `isCurrent`/`sortOrder` (experiências e bullets) e `isCurrent` (formações); a tradução de `ER_DUP_ENTRY` de skills usa apenas `UQ_profile_skills_profile_skill`; `assertDateOrder` aceita `endField` para mensagens como `expiryDate`.
- [x] Atualizar este ADR para `Accepted` após lint/build/test e e2e verdes.

Validação local registrada em 2026-11-18 (branch `feat/sprint-2-profile`, HEAD `00b0647`):
`npm run lint` exit 0 (1 warning preexistente em `test/auth.e2e-spec.ts:232`),
`npx tsc --noEmit` e `npm run build` exit 0, `npm test` 232/232 (21 arquivos),
`npm run test:e2e` 192/192 (6 arquivos), `npm run migration:run` sem pendências, seed
executado 2x com 118 skills e aliases obrigatórios conferidos no banco. Commit e push
seguem pendentes de aprovação humana; nada foi enviado ao remoto.

## Referências

- `docs/prompt-kandid.md:93-101` (modelo `skill`), `:96-97` (aliases obrigatórios),
  `:168` (`SkillCategory`), `:209-216` (normalização do ATS), `:459` (`common/utils/`),
  `:503` (Fase 1), `:555` (seed idempotente).
- `docs/sprints/sprint-02.md:74-84` (critérios de skills), `:286`, `:289`, `:291-294`,
  `:361-364` (concorrência, datas, dinheiro e riscos).
- `src/database/migrations/1794268800000-CreateProfileDomain.ts:31`, `:36`, `:50-53`, `:66`.
- `src/modules/skills/skills.service.ts:24-29`, `src/modules/skills/entities/skill.entity.ts:24-36`,
  `src/modules/skills/entities/profile-skill.entity.ts:26-28`, `:50-58`,
  `src/modules/profiles/entities/profile.entity.ts:106-116`.
- `src/common/validators/is-date-only.validator.ts:11-19`,
  `src/common/filters/all-exceptions.filter.ts:54-64`.
