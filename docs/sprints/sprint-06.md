# Sprint 6 — Export, entrevistas e dashboards

- Status: Em validação — escopo, contratos, critérios e código alinhados ao ADR 0006 e aos rulings R1-R13 do tech lead; e2e, revisão e demo pendentes
- Épico: E5 — Export e dashboard (`docs/backlog.md:134-142`)
- Branch: `feat/sprint-6-export-dashboard`, base `667bf83` (merge do PR #13, que integra a Sprint 5 em `main`)
- Início: 2026-11-19 (documento de planejamento)
- Escopo: KAN-50 a KAN-54

## Objetivo

**Sprint goal:** fechar o ciclo de valor do currículo com export JSON/HTML determinístico,
registrar entrevistas por candidatura e entregar visão agregada do funil e da
compensação — tudo escopado por usuário, sem alterar `applications` nem o histórico
append-only de status.

A sprint cobre os cinco itens de E5 no backlog (`docs/backlog.md:134-142`) e resolve,
de uma vez, os dois adiamentos da Sprint 5: export JSON/HTML (KAN-50/51) e o bloco de
entrevistas/dashboards da Fase 4 (`docs/prompt-kandid.md:526-534`). O seed de
demonstração (`spec:531-534`, KAN-60) **não** entra aqui e permanece na Sprint 7.

## Escopo

### Histórias

| ID | História | Entrega principal | Estimativa |
|---|---|---|---|
| KAN-50 | Exportar currículo em JSON | `GET /v1/resume-versions/:id/export?format=json`, query estrita, ownership por join, snapshot integral + `resumeId`/`version`/`atsScore` | 1 dia |
| KAN-51 | Exportar currículo em HTML | Renderer puro e determinístico, HTML5 semântico de coluna única, CSS embutido, escaping de XSS, títulos fixos | 1 dia |
| KAN-52 | CRUD de entrevistas | Tabela `interviews`, enums `InterviewType`/`InterviewStatus`/`InterviewOutcome`, 5 rotas aninhadas, `unique(application_id, round)`, ordenação estável | 2 dias |
| KAN-53 | Dashboard de funil | `GET /v1/dashboard/summary`: contagem por status, taxa de resposta/entrevista/oferta, tempo médio até primeira resposta e médias por etapa | 2 dias |
| KAN-54 | Dashboard de compensação | `GET /v1/dashboard/compensation`: proposto × ofertado, diferença em centavos e percentual, médias por senioridade e por skill, por moeda e periodicidade | 2 dias |

Definition of Ready por história: critérios Given/When/Then abaixo, contratos e exemplos
na seção Contratos, fórmulas e regras na seção Regras de negócio, modelo de dados
definido, demo manual executável, dependências listadas e estimativa ≤ 2 dias.

### Decisões registradas (tech lead / PO)

Decisões **fixadas para implementação** e sujeitas apenas à confirmação do portão
humano nos pontos listados em Pendente de validação humana/architect:

1. **Escopo é somente KAN-50..54.** Seed de demonstração é KAN-60 (Sprint 7) e fica
   fora, mesmo que a Fase 4 da spec (`spec:531-534`) junte seed e dashboard. O backlog
   prevalece. Nenhum `npm run seed:demo` ou dado de demo é criado nesta sprint.
2. **Export:** `GET /v1/resume-versions/:id/export?format=json|html`. `format` é
   obrigatório e aceita somente `json` ou `html` em minúsculas; ausente, vazio,
   repetido (`?format=json&format=html`), fora da lista ou com outra caixa → 400.
   Nunca há default implícito. Ownership por join
   (`resume_versions → resumes.user_id`); versão alheia ou inexistente → 404.
3. **Export JSON:** corpo `{ resumeId, version, atsScore, contentSnapshot }`, sem
   envelope `{ data }` e sem campos extras. `contentSnapshot` é o `content_snapshot`
   persistido, integral e inalterado. `atsScore` é o `score` da análise ATS mais
   recente daquela versão (`ORDER BY created_at DESC, id ASC`), ou `null` quando não
   há análise. A coluna `resume_versions.ats_score` continua sempre nula e **não** é
   usada. `Content-Type: application/json`.
4. **Export HTML:** gerado on demand, determinístico (mesmo snapshot + mesma análise →
   mesmos bytes), sem template engine externa. HTML5 semântico, coluna única, CSS
   embutido em `<style>` no `<head>` (sem arquivo externo), `lang="pt-BR"`, sem
   tabelas, imagens, ícones, SVG, iframes ou JavaScript. Todo conteúdo do usuário é
   escapado. Títulos fixos, nesta ordem: `Resumo`, `Habilidades`,
   `Experiência Profissional`, `Formação`, `Certificações`, `Idiomas`.
   `Content-Type: text/html; charset=utf-8`. Export não escreve no banco.
5. **Entrevistas:** tabela física plural `interviews`, entidade `Interview`, campos
   exatamente como `spec:144-145` (`application_id`, `round`, `type`, `scheduled_at`,
   `duration_minutes`, `interviewer_name`, `interviewer_role`, `meeting_url`,
   `status`, `feedback`, `outcome`), **sem** `user_id`. Ownership via
   `application → user_id`. Rotas `POST/GET /v1/applications/:id/interviews` e
   `GET/PATCH/DELETE /v1/applications/:id/interviews/:interviewId`. Entrevista
   **não** é append-only: pode ser editada e excluída.
6. **Dashboards:** escopados por usuário, em `GET /v1/dashboard/summary` e
   `GET /v1/dashboard/compensation`, autenticados, somente leitura, sem query
   parameters (qualquer query → 400).
7. **Dinheiro:** sempre centavos + `currency`. Nunca agregar moedas diferentes:
   médias, diferenças e percentuais são agrupados por moeda. Como `salary_period`
   também muda a grandeza, todo agrupamento usa o par **`(currency, salary_period)`**;
   periodicidades diferentes nunca são somadas nem normalizadas. Bases vazias
   retornam `null` explícito.
8. **Nenhuma entidade, rota ou campo de domínio fora de `spec:570-573`.** Respostas
   derivadas (taxas, médias) são permitidas; campos de infraestrutura como
   `created_at`/`updated_at` seguem o padrão das tabelas existentes.
9. **Migration:** `1795824000000-CreateInterviewDomain`, classe
   `CreateInterviewDomain1795824000000`, sequencial após
   `1795737600000-CreateResumeDomain` (R7). A tabela `interviews` usa FK
   `FK_interviews_application` (`application_id → applications.id`, `ON DELETE
   CASCADE`, R5), `UNIQUE (application_id, round)` e o índice composto
   `IX_interviews_application_round_scheduled (application_id, round, scheduled_at,
   id)` para a listagem ordenada (R6). Ajustar o timestamp se houver conflito,
   registrando a escolha. `synchronize: false` mantido. Nenhuma alteração em tabelas
   existentes.
10. **Status HTTP e formato:** 201 em criação, 200 em leitura/atualização, 204 em
    delete, 400 em validação, 401 sem token, 404 em recurso alheio/inexistente, 409
    em conflito de unicidade. Erro no envelope único
    `{ statusCode, error, message, path, timestamp }`. `GET` de entrevistas devolve
    **array puro** (sem paginação), como `GET /v1/applications/:id/history`; os dois
    dashboards devolvem objeto puro, sem envelope.
11. **Entrevistas — defaults e validação:** `round` inteiro ≥ 1 informado pelo
    cliente; `type` obrigatório; `scheduled_at` obrigatório ISO 8601 com timezone,
    normalizado para UTC; `duration_minutes` inteiro 1–1440; `status` default
    `SCHEDULED`; `outcome` default `PENDING`; `interviewer_name`/`interviewer_role` ≤
    120; `meeting_url` ≤ 255 e `http/https`; `feedback` livre;
    `created_at`/`updated_at` são campos de infraestrutura padrão. PATCH parcial com
    body vazio → 200 sem alteração; `null` só limpa campos opcionais. Ordem da
    listagem: `round ASC, scheduled_at ASC, id ASC`.
12. **Entrevistas não alteram a candidatura:** criar/editar/excluir entrevista não
    muda `applications.status`, não grava `application_status_history` e não preenche
    `applied_at`/`closed_at`. A máquina de estados continua sendo a única fonte de
    transição.
13. **Fórmulas do summary:** taxas em **percentual 0..100, 2 casas half-up**
    (`Math.round(x*100)/100`), `null` quando denominador 0; nomes e formatos seguem o
    ADR 0006. `submitted` = candidaturas com `applied_at IS NOT NULL`, único contador
    de base exposto ao lado das taxas. `responseRate` = submetidas com status atual ou
    histórico em `SCREENING|SCHEDULED|INTERVIEW|OFFER|HIRED|REJECTED` sobre
    `submitted`. `interviewRate` = **união**: submetidas que tenham ao menos uma
    entrevista `SCHEDULED`/`COMPLETED` **ou** que alcançaram
    `INTERVIEW|OFFER|HIRED`, sobre `submitted`. `offerRate` = alcançaram
    `OFFER|HIRED` sobre `submitted`. `averageTimeToFirstResponseDays`: início
    `applied_at` (00:00 UTC) com fallback para a primeira transição `→ APPLIED`; fim =
    primeira transição para status de resposta; sem base ou delta negativo → excluída;
    média em dias, 2 casas, `null` sem amostra. `averageDaysPerStage`: âncora sintética
    `(status inicial, created_at)`, segmentos fechados pelo próximo evento, último
    segmento aberto excluído, atribuído ao status vigente, `SAVED` incluído, itens
    `{ status, averageDays, sampleSize }` para os 11 status.
14. **Compensação:** agrupamento por `(currency, salary_period)`; `byCurrency[]` com
    `currency`, `salaryPeriod`, `applicationCount`, `proposed`/`offered` com
    `count`/`minCents`/`maxCents`/`averageCents` e `difference` com
    `pairedSampleSize`, `absoluteCents` com sinal e `percentage` só quando a média do
    proposto pareado > 0. `bySeniority[]` e `bySkill[]` ficam no topo do objeto, como
    irmãos de `byCurrency[]`, e repetem `currency`/`salaryPeriod` em cada item;
    senioridade vem de `jobs.seniority` (bucket `null`) e skills de
    `job_skills → skills`. `null` sem base.
15. **Export/dashboards são somente leitura.** Nenhuma escrita em `resume_versions`,
    `ats_analyses`, `applications`, `application_status_history` ou `interviews` por
    GET. Nenhuma dessas rotas cria linha, atualiza timestamp ou dispara evento.
16. **Sem seed, sem README e sem release nesta sprint.** A demo usa dados criados
    manualmente via API.

### Resolução de conflitos entre este documento, a spec e as decisões

A implementação deve seguir **esta** seção quando houver divergência:

| Tema | Decisão | Justificativa |
|---|---|---|
| Seed junto do dashboard (`spec:531-534`) | Seed de demonstração fica na Sprint 7 (KAN-60); Sprint 6 entrega só KAN-50..54 e a demo usa dados manuais | O backlog (`backlog.md:134-150`) separa E5 de E6; o "Pronto quando" da Fase 4 é atingido com dashboard coerente sobre dados criados via API |
| Export na Fase 3 (`spec:521,524`) vs. Sprint 6 | Export JSON/HTML é entregue agora (KAN-50/51), encerrando o adiamento da Sprint 5 | O backlog coloca export em E5/Sprint 6; a spec não define prazo, apenas escopo |
| `POST /analyze` "atualiza `ats_score`" (`spec:522`) vs. imutabilidade (`spec:83,152-154`) | A coluna `resume_versions.ats_score` continua nula; o export deriva `atsScore` da análise mais recente em `ats_analyses` | Decisão da Sprint 5/ADR 0005 preservada: versão é imutável; nenhuma escrita em `resume_versions` |
| `interview` (singular, `spec:144`) vs. nomenclatura do projeto | Tabela `interviews`, entidade `Interview` | Padrão plural de `applications`, `resumes`, `resume_versions` e `ats_analyses` |
| `interview` sem `created_at`/`updated_at` (`spec:144-145`) | Colunas de infraestrutura `created_at`/`updated_at` são adicionadas, como em `applications` (modelo da spec também não as lista) | Entidade editável precisa de rastreio; não são campos de domínio nem entram em DTOs de request |
| `CRUD /v1/applications/:id/interviews` (`spec:412`) | Cinco rotas explícitas, com sub-recurso `:interviewId` | Mesmo padrão de `experiences/:id/bullets/:bulletId`; CRUD abreviado não define contrato |
| `GET /dashboard/summary` (`spec:420`) | `GET /v1/dashboard/summary` e `/v1/dashboard/compensation` | Prefixo global `/v1` (`spec:376`) |
| `job_skill` (`spec:131`) vs. tabela real | Usar `job_skills` já existente | Fonte da verdade é o schema implementado na Sprint 3 |
| Moeda apenas (decisão 7) vs. periodicidade | Agrupar por `(currency, salary_period)` | Misturar mensal e anual produz média sem significado; decisão 7 é complementada, não reaberta |
| Export com metadados | Exatamente `resumeId`, `version`, `atsScore`, `contentSnapshot`, em camelCase | `ResumeVersionResponseDto` já expõe `contentSnapshot`; não inventar `id`, `jobId` ou `createdAt` no export |
| HTML "CSS inline" | `<style>` embutido no `<head>`, sem stylesheet externo | Mantém documento autocontido e determinístico; alternativa `style=""` em cada elemento foi rejeitada por duplicação |
| `projects` no snapshot vs. títulos fixos (`spec:371`) | `projects` não é renderizado no HTML | A spec fixa a lista de títulos e não inclui projetos; registrar no portão |
| Entrevista alterando funil | Nenhuma transição automática de status | A máquina de estados exige `PATCH /status` explícito e histórico transacional (`spec:198-203`) |
| R1 — unidade das taxas | Percentual 0..100, 2 casas half-up; `null` sem base; sem `numerator`/`denominator` | Consistência com `score` ATS 0..100 e nenhum campo inventado |
| R2 — `interviewRate` | União: entrevista `SCHEDULED`/`COMPLETED` **ou** status/histórico `INTERVIEW|OFFER|HIRED` | Não penaliza candidatura que alcançou entrevista sem registro no CRUD |
| R3 — início da primeira resposta | `applied_at` (00:00 UTC), fallback para a primeira transição `→ APPLIED` | Usa a data de submissão quando existe, sem descartar histórico legado |
| R4 — tempo por etapa | Âncora sintética `(status inicial, created_at)`; último segmento aberto excluído; `SAVED` incluído com `sampleSize` | Mantém o cálculo determinístico entre requests e preserva a etapa inicial |
| R5 — FK `interviews.application_id` | `FK_interviews_application ... ON DELETE CASCADE` | `application_status_history` já usa `CASCADE`; entrevista é registro filho, não auditoria |
| R6 — índice de listagem | Manter `IX_interviews_application_round_scheduled (application_id, round, scheduled_at, id)` | A UNIQUE cobre só `(application_id, round)` e não evita filesort em `scheduled_at, id` |
| R7 — migration | `1795824000000-CreateInterviewDomain`, classe `CreateInterviewDomain1795824000000` | Singular `Domain`, como `CreateResumeDomain`; tabela física permanece plural `interviews` |
| R8 — timestamps em `interviews` | `created_at`/`updated_at` mantidos, fora dos DTOs de request | Infraestrutura padrão das tabelas mutáveis; não são campos de domínio |
| R9 — `durationMinutes` | Obrigatório no POST e no PATCH, inteiro 1..1440; `NOT NULL` na migration | Duração é conhecida no agendamento; evita `NULL` e divide o ADR 0006 |
| R10 — HTML determinístico | `<title>` `{name} — Currículo` (fallback `{targetRole} — Currículo`); allowlist só `http`/`https`, e-mail como texto; sem rodapé/`version`/`generatedAt` | Exemplo canônico da sprint e teste byte-a-byte; metadados ficam no JSON |
| R11 — resposta e oferta | Status atual **ou** histórico, com os conjuntos definidos | Dados importados sem histórico não são penalizados |
| R12 — amostra do fallback | `averageTimeToFirstResponseDays` usa `U`, não `S` | Candidatura sem `applied_at` mas com transição `→ APPLIED` entra só neste cálculo |
| R13 — limite de `feedback` | `@MaxLength(5000)` no POST e no PATCH | Preserva A12 do ADR 0006; evita estouro da coluna `text` e 500 |

### Dependências

- Sprint 1: `users`, JWT com `sub`, `JwtAuthGuard`, `@CurrentUser()`, `ValidationPipe`
  global, filtro único de erro e helpers.
- Sprint 2: perfil e seções do snapshot (somente leitura para export).
- Sprint 3: `jobs` com `seniority`, `job_skills` e catálogo `skills` (somente leitura
  para compensação).
- Sprint 4: `applications` e `application_status_history` com dados de funil e
  compensação (somente leitura; nenhuma alteração de schema).
- Sprint 5: `resumes`, `resume_versions` (com `content_snapshot` imutável) e
  `ats_analyses` (somente leitura para export).
- Enums novos `InterviewType`, `InterviewStatus` e `InterviewOutcome`
  (`spec:173-175`) criados em `src/common/enums/`, sem duplicar enums existentes.
- Migration sequencial após `1795737600000-CreateResumeDomain`; `synchronize: false`.
- MySQL local para e2e (`docker compose up -d` em `kandid_api/`).
- Nenhuma dependência nova de template engine, HTML sanitizer ou biblioteca de
  gráficos.

### Fora de escopo

- Seed de demonstração (KAN-60), README de portfólio (KAN-62), CodeQL/Dependabot/Sentry
  (KAN-61) e release v1.0.0 (KAN-63).
- Export de `resumes` (currículo), de perfil ou de candidatura; rota
  `/v1/resumes/:id/export` **não existe**.
- PDF, DOCX, upload, OCR, IA, LLM e geração de arquivo em disco.
- Template customizável, escolha de tema/idioma no export, `Content-Disposition` com
  nome de arquivo e cache HTTP.
- Alteração de `applications`, `application_status_history`, `resume_versions` ou
  `ats_analyses`; transição automática de status ao criar entrevista.
- Paginação, filtros, período, agrupamento configurável ou ordenação customizada nos
  dashboards e na listagem de entrevistas.
- Frontend, gráficos, export CSV/planilha e comparação entre usuários.
- Roles, permissões, multi-tenant, deploy e banco remoto.

## Critérios de aceite

### KAN-50 — Exportar currículo em JSON

**Como** usuário autenticado **quero** baixar uma versão do meu currículo em JSON
**para** reutilizar o snapshot em outros sistemas sem perder os metadados da versão.

- Dado que estou autenticado e a versão pertence a um currículo meu, quando envio `GET /v1/resume-versions/:id/export?format=json`, então recebo 200 com `Content-Type` iniciando em `application/json` e corpo com exatamente `resumeId`, `version`, `atsScore` e `contentSnapshot`, sem envelope `{ data }`.
- Dado que a versão foi gerada, quando comparo `contentSnapshot` do export com `contentSnapshot` de `GET /v1/resume-versions/:id`, então os dois são estruturalmente idênticos, incluindo `schemaVersion`, `generatedAt`, seções vazias e ordem dos arrays; nenhum campo é removido, resumido ou reformatado semanticamente.
- Dado que a versão possui análises ATS, quando exporto em JSON, então `atsScore` é o `score` da análise mais recente daquela versão por `created_at DESC, id ASC`, inclusive quando a análise foi feita para `jobId` diferente do `jobId` da versão; `resume_versions.ats_score` não é lido.
- Dado que a versão não possui nenhuma análise, quando exporto em JSON, então `atsScore` é `null`, nunca `0`, e `contentSnapshot` continua completo.
- Dado que envio a requisição sem `format`, com `format=` vazio, `?format=pdf`, `?format=JSON`, `?format=Html` ou com `format` repetido, então recebo 400 com mensagem que cita `format` e os valores aceitos, e nenhum corpo de export é retornado; não existe default.
- Dado que envio query param adicional (`download`, `jobId`, `pretty` etc.), quando exporto, então recebo 400 pelo `forbidNonWhitelisted`; o único parâmetro aceito é `format`.
- Dado que a versão pertence a outro usuário ou não existe, quando exporto, então recebo 404 com mensagem genérica, sem revelar existência; `:id` que não é UUID → 400 (`ParseUUIDPipe`).
- Dado que não envio `Authorization`, quando chamo qualquer variante do export, então recebo 401.
- Dado que exporto duas vezes com o mesmo estado de banco, então os dois corpos JSON são idênticos e nenhuma linha é criada ou alterada em `resume_versions` ou `ats_analyses`.
- Dado que tento `GET /v1/resumes/:id/export?format=json`, então a rota não existe; export é exclusivo de `resume-versions` (404/405 conforme o framework).
- Dado que a versão tem `contentSnapshot` com caracteres especiais (`<`, `>`, `&`, aspas, Unicode), quando exporto em JSON, então os valores são preservados como dados JSON válidos, sem escape duplo.

### KAN-51 — Exportar currículo em HTML

**Como** usuário autenticado **quero** visualizar e imprimir uma versão do meu currículo
em HTML **para** compartilhar ou converter em PDF pelo navegador com layout estável.

- Dado que estou autenticado e a versão é minha, quando envio `GET /v1/resume-versions/:id/export?format=html`, então recebo 200 com `Content-Type: text/html; charset=utf-8` e corpo começando por `<!doctype html>`, com `<html lang="pt-BR">`, `<meta charset="utf-8">`, `<head>` com `<title>` e `<style>`, e `<body>` com um único `<main>`.
- Dado o snapshot da versão, quando o HTML é gerado, então não há `<table>`, `<img>`, `<svg>`, `<iframe>`, `<script>`, `<link rel="stylesheet">`, `src=`, ícones, fontes externas nem JavaScript; o layout é de coluna única e o CSS está embutido no `<style>`.
- Dado que o snapshot tem dados em todas as seções, quando o HTML é gerado, então as seções aparecem exatamente nesta ordem e com estes títulos: `Resumo`, `Habilidades`, `Experiência Profissional`, `Formação`, `Certificações`, `Idiomas`, cada uma em `<section>` com `<h2>`.
- Dado que uma seção está vazia ou ausente no snapshot, quando o HTML é gerado, então a seção inteira é omitida (título inclusive), sem placeholders como "Não informado"; o restante do documento permanece válido e não há rodapé (R10).
- Dado que o snapshot contém texto do usuário com `<script>alert(1)</script>`, `"`, `'`, `&` ou `<img onerror=...>`, quando o HTML é gerado, então todo o conteúdo é escapado (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`) e nenhuma marcação do usuário é interpretada como HTML; o mesmo vale para `<title>` e atributos `href`.
- Dado que o snapshot tem links de candidato (`linkedin`, `github`, `portfolio`), quando o HTML é gerado, então apenas URLs com esquema `http:` ou `https:` viram `<a href="...">` com href escapado; qualquer outro esquema (`javascript:`, `data:`) é renderizado como texto puro.
- Dado que o snapshot tem datas `YYYY-MM` e `YYYY-MM-DD`, quando o HTML é gerado, então são exibidas como `MM/YYYY` e `DD/MM/YYYY`; experiência/formação com `current: true` ou sem `endDate` mostra `Atual`; nenhuma data é inventada.
- Dado que o snapshot tem experiência, formação, certificação, idioma ou skill com campos opcionais ausentes, quando o HTML é gerado, então o item é renderizado com os campos presentes, sem `null`, `undefined` ou separadores órfãos.
- Dado que o snapshot tem `projects`, quando o HTML é gerado, então nenhuma seção de projetos é criada, pois a lista de títulos da spec não a inclui (ver ambiguidade 6).
- Dado o mesmo snapshot, quando gero o HTML duas vezes, então os bytes são idênticos, sem timestamp de geração, IDs aleatórios ou ordem dependente de locale/hash.
- Dado que o export HTML é chamado, então `atsScore`, `resumeId`, `version` e a existência de análises não aparecem no documento e nenhuma escrita ocorre no banco.
- Dado `format` ausente/inválido, versão alheia/inexistente, `:id` inválido ou falta de token, quando exporto em HTML, então as respostas são 400, 404, 400 e 401, respectivamente, com o mesmo envelope de erro do JSON.
- Dado que abro o HTML em navegador, quando imprimo, então o conteúdo flui em coluna única, sem overflow horizontal em largura A4, sem imagens quebradas ou recursos externos.

### KAN-52 — CRUD de entrevistas

**Como** usuário autenticado **quero** registrar e manter as entrevistas de cada
candidatura **para** acompanhar rodadas, horários, entrevistadores e resultados.

- Dado que estou autenticado e a candidatura é minha, quando envio `POST /v1/applications/:id/interviews` com `{ "round": 1, "type": "TECHNICAL", "scheduledAt": "2026-11-25T14:00:00.000Z", "durationMinutes": 60 }`, então recebo 201 com `id`, `applicationId` igual ao `:id`, `round: 1`, `type: "TECHNICAL"`, `scheduledAt` em ISO 8601 UTC, `durationMinutes: 60`, `status: "SCHEDULED"` (default), `outcome: "PENDING"` (default), campos descritivos `null` quando omitidos e `createdAt`/`updatedAt` ISO 8601 UTC.
- Dado que envio `status`, `outcome`, `interviewerName`, `interviewerRole`, `meetingUrl` ou `feedback` válidos, quando crio, então os valores informados substituem os defaults; `feedback: null`, `interviewerName: null` e demais opcionais aceitam `null`.
- Dado que a candidatura não existe ou pertence a outro usuário, quando crio, listo, leio, atualizo ou excluo, então recebo 404 sem revelar existência; `:id` inválido → 400 (`ParseUUIDPipe`).
- Dado que `round` está ausente, não é inteiro (`1.5`, `"1"`), é 0 ou negativo, então recebo 400 e nada é persistido.
- Dado que `type` está ausente ou fora de `HR|TECHNICAL|BEHAVIORAL|CASE|CULTURAL|FINAL`, então recebo 400.
- Dado que `scheduledAt` está ausente, é data-only (`2026-11-25`), não é ISO 8601 com timezone ou é inválido, então recebo 400; com offset (`2026-11-25T11:00:00-03:00`) é aceito e persistido/normalizado como UTC.
- Dado que `durationMinutes` está ausente, é 0, negativo, não inteiro ou maior que 1440, então recebo 400; `1` e `1440` são aceitos.
- Dado que `status` ou `outcome` enviados não pertencem a `InterviewStatus`/`InterviewOutcome`, então recebo 400.
- Dado `interviewerName`/`interviewerRole` acima de 120 caracteres, `meetingUrl` acima de 255 ou com esquema diferente de `http`/`https`, então recebo 400; `feedback` é texto livre.
- Dado que envio `userId`, `user_id`, `applicationId`, `application_id`, `id`, `createdAt` ou `updatedAt` no body, então recebo 400 pelo `forbidNonWhitelisted`.
- Dado que já existe entrevista com o mesmo `(application_id, round)`, quando crio outra igual, então recebo 409 (`UQ_interviews_application_round`) e nenhuma linha é gravada; a mesma `round` em candidatura diferente é aceita com 201.
- Dado que listo `GET /v1/applications/:id/interviews` de candidatura minha, então recebo 200 com array puro (sem envelope, sem paginação) ordenado por `round ASC, scheduledAt ASC, id ASC`; candidatura sem entrevistas → 200 `[]`.
- Dado que envio query param na listagem, então recebo 400; a listagem não aceita filtros nem paginação nesta sprint.
- Dado que consulto `GET /v1/applications/:id/interviews/:interviewId` de entrevista minha, então recebo 200 com o mesmo DTO; entrevista que pertence a outra candidatura (mesmo do usuário) ou a outro usuário → 404.
- Dado que envio `PATCH .../interviews/:interviewId` com subconjunto de campos, então recebo 200 e os campos ausentes permanecem inalterados; `null` em `round`, `type`, `scheduledAt`, `durationMinutes`, `status` ou `outcome` → 400; `null` em `interviewerName`, `interviewerRole`, `meetingUrl` ou `feedback` limpa o campo.
- Dado que o `PATCH` altera `round` para um valor já usado na mesma candidatura, então recebo 409 e nada é alterado; alterar para `round` livre → 200.
- Dado que envio `PATCH` com body vazio (`{}`), então recebo 200 com a entrevista inalterada (no-op), sem novo `updatedAt`.
- Dado que excluo `DELETE .../interviews/:interviewId`, então recebo 204 sem corpo; novo `GET` do mesmo id → 404; excluir novamente → 404; entrevista alheia → 404.
- Dado que crio, atualizo ou excluo entrevistas, então `applications.status`, `applied_at`, `closed_at` e `application_status_history` permanecem exatamente como estavam; nenhuma transição é disparada.
- Dado que não envio `Authorization`, quando chamo qualquer rota de entrevistas, então recebo 401.
- Dado que duas requisições concorrentes criam a mesma `(application_id, round)`, então no máximo uma recebe 201 e a outra recebe 409 (tradução de `ER_DUP_ENTRY`).

### KAN-53 — Dashboard de funil

**Como** usuário autenticado **quero** ver o resumo agregado das minhas candidaturas
**para** entender conversão, gargalos e tempo de resposta do meu funil.

- Dado que estou autenticado, quando envio `GET /v1/dashboard/summary`, então recebo 200 com objeto puro `totalApplications`, `submitted`, `countsByStatus`, `responseRate`, `interviewRate`, `offerRate`, `averageTimeToFirstResponseDays` e `averageDaysPerStage`, sem envelope `{ data }` e sem contadores auxiliares.
- Dado que tenho candidaturas em vários status, quando consulto, então `countsByStatus` traz os 11 status de `ApplicationStatus` na ordem do enum (`SAVED, APPLIED, SCREENING, SCHEDULED, INTERVIEW, OFFER, HIRED, REJECTED, WITHDRAWN, CANCELLED, GHOSTED`), com zeros explícitos, e `totalApplications` é a soma de todos os status.
- Dado que tenho candidaturas salvas e candidaturas efetivamente enviadas, quando consulto, então `submitted` conta somente candidaturas com `applied_at IS NOT NULL`; `SAVED` e `SAVED → CANCELLED` ficam fora do denominador das três taxas.
- Dado que uma candidatura saiu de `APPLIED` para `SCREENING`, `SCHEDULED`, `INTERVIEW`, `OFFER`, `HIRED` ou `REJECTED` em qualquer momento (status atual ou histórico), quando consulto, então ela conta no numerador de `responseRate` mesmo que o status atual seja `WITHDRAWN`, `CANCELLED` ou `GHOSTED`; `APPLIED` isolado e `GHOSTED` sem resposta anterior não contam.
- Dado que uma candidatura submetida tem ao menos uma entrevista com `status` `SCHEDULED` ou `COMPLETED` **ou** alcançou `INTERVIEW`, `OFFER` ou `HIRED` (status atual ou histórico), quando consulto, então ela conta no numerador de `interviewRate` pela união das duas condições; `CANCELLED`/`NO_SHOW` sozinhos não contam.
- Dado que uma candidatura alcançou `OFFER` ou `HIRED` (status atual ou histórico), quando consulto, então ela conta no numerador de `offerRate`.
- Dado que `submitted > 0`, quando consulto, então `responseRate`, `interviewRate` e `offerRate` são percentuais 0..100 com 2 casas (`Math.round(x*100)/100`), calculados como `100 * numerador / submitted`; dado `submitted = 0`, então as três taxas são `null`.
- Dado uma candidatura com `applied_at` ou transição `→ APPLIED`, quando consulto, então o tempo até a primeira resposta usa `applied_at` (00:00 UTC) com fallback para a primeira transição `→ APPLIED` e o menor `changed_at` de transição para status de resposta; `averageTimeToFirstResponseDays` é a média em dias, 2 casas; sem início, sem fim ou delta negativo a candidatura é excluída; sem amostra o valor é `null`.
- Dado que o histórico tem transições consecutivas, quando consulto, então `averageDaysPerStage` usa a âncora sintética `(status inicial, created_at)` e segmentos fechados pelo próximo evento, ordenados por `changed_at ASC, id ASC`, atribuídos ao status vigente; o último segmento aberto é excluído e `SAVED` é incluído.
- Dado o array `averageDaysPerStage`, quando consulto, então ele traz os 11 status na ordem do enum, cada item `{ status, averageDays, sampleSize }`; sem amostra, `averageDays: null` e `sampleSize: 0`; médias em dias com 2 casas.
- Dado o cenário de fixture do exemplo de contrato (6 candidaturas: 1 SAVED, 1 APPLIED, 1 SCREENING, 1 INTERVIEW, 1 OFFER, 1 REJECTED), quando consulto, então `totalApplications: 6`, `submitted: 5`, `responseRate: 80`, `interviewRate: 40`, `offerRate: 20` e os valores de `averageDaysPerStage` são exatamente os do exemplo.
- Dado que outro usuário tem candidaturas, quando consulto, então nenhum número inclui dados dele; recurso alheio nunca entra nas contagens.
- Dado que não tenho candidaturas, quando consulto, então `totalApplications: 0`, `submitted: 0`, as três taxas e `averageTimeToFirstResponseDays` são `null`, `countsByStatus` tem 11 chaves com zero e `averageDaysPerStage` tem 11 itens com `averageDays: null`/`sampleSize: 0`.
- Dado que envio query param (`?from=`, `?status=`), então recebo 400; o endpoint não aceita parâmetros nesta sprint.
- Dado que não envio `Authorization`, então recebo 401.
- Dado que consulto o dashboard, então nenhuma linha é criada/alterada em `applications`, `application_status_history`, `interviews` ou qualquer outra tabela; a resposta pode ser repetida com os mesmos números enquanto os dados não mudarem.

### KAN-54 — Dashboard de compensação

**Como** usuário autenticado **quero** comparar valores propostos e ofertados **para**
avaliar se minhas expectativas estão alinhadas com as ofertas, por senioridade e skill.

- Dado que estou autenticado, quando envio `GET /v1/dashboard/compensation`, então recebo 200 com objeto puro com `byCurrency[]`, `bySeniority[]` e `bySkill[]` como campos irmãos no topo, sem envelope `{ data }`; os itens de `byCurrency[]` trazem `currency`, `salaryPeriod`, `applicationCount`, `proposed`, `offered` e `difference`, e os itens de `bySeniority[]`/`bySkill[]` repetem `currency`/`salaryPeriod`, todos escopados pelo meu `userId`.
- Dado que tenho candidaturas em BRL e USD ou em MONTH e YEAR, quando consulto, então nunca há mistura de moedas ou periodicidades no mesmo grupo; cada grupo corresponde ao par `(currency, salaryPeriod)` e nenhuma conversão ou normalização é aplicada.
- Dado `proposed` e `offered` de um grupo, quando consulto, então cada estrutura traz `{ count, minCents, maxCents, averageCents }`; com `count: 0`, os três valores monetários são `null`.
- Dado `difference` de um bucket, quando consulto, então ele traz `{ absoluteCents, percentage, pairedSampleSize }` (nesta ordem, conforme ADR 0006 e a implementação); `absoluteCents` é a média pareada de `offered - proposed` com sinal preservado e centavos inteiros, e `percentage` é o percentual com 2 casas calculado só sobre a amostra pareada com média do proposto > 0.
- Dado que uma candidatura tem proposto e ofertado, quando calculo, então ela entra em `pairedSampleSize`; com proposto = 0 ela entra na média em centavos, mas fica fora do percentual; sem pares, `pairedSampleSize: 0` e ambas as médias de diferença são `null`.
- Dado que faltam valores, quando consulto, então a candidatura só entra nas estatísticas da base que possui e `applicationCount` conta quem tem ao menos um dos dois; candidatura sem nenhum valor não cria grupo.
- Dado `bySeniority[]` no topo do objeto, quando consulto, então ele agrupa por `(currency, salaryPeriod, seniority)` com as mesmas estatísticas e repete `currency`/`salaryPeriod` em cada item; vaga sem senioridade aparece com `seniority: null`; combinações sem dados não são inventadas e a soma dos `applicationCount` reconcilia com `byCurrency[]`.
- Dado `bySkill[]` no topo do objeto, quando consulto, então ele deriva de `job_skills → skills`, trazendo `currency`, `salaryPeriod`, `skillId`, `skillName` e as mesmas estatísticas; todas as skills da vaga entram, independentemente de `is_required`, e uma candidatura pode contribuir para várias skills, então a soma não reconcilia com `byCurrency[]`; vaga sem skill não cria bucket "sem skill".
- Dado que uma base está vazia em qualquer nível, quando consulto, então os valores monetários ausentes são `null` explícito, nunca `0`.
- Dado o cenário de fixture do exemplo de contrato (BRL/MONTH com 4 candidaturas e USD/YEAR com 1), quando consulto, então os grupos e os arrays `bySeniority`/`bySkill` são exatamente os do exemplo, com `10.59` na BRL pareada e `null` na diferença de MID.
- Dado que não tenho candidaturas com valores propostos ou ofertados, quando consulto, então recebo `{ "byCurrency": [], "bySeniority": [], "bySkill": [] }` com 200.
- Dado que outro usuário tem candidaturas, quando consulto, então nenhum grupo inclui dados dele; recurso alheio nunca entra nas contagens.
- Dado que envio query param (`?currency=`, `?seniority=`), então recebo 400.
- Dado que não envio `Authorization`, então recebo 401.
- Dado que consulto o dashboard, então nenhuma linha é criada/alterada em `applications`, `jobs`, `job_skills`, `skills` ou qualquer outra tabela.

## Contratos

Todas as rotas exigem `Authorization: Bearer <jwt>` e usam o prefixo global `/v1`.
O `userId` vem exclusivamente do token (`@CurrentUser()`). IDs de path usam
`ParseUUIDPipe`. Erros seguem `{ statusCode, error, message, path, timestamp }`.
`format` é validado por DTO de query com whitelist; entrevistas usam `:id` para a
candidatura e `:interviewId` para a entrevista.

| Método | Rota | Request | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/v1/resume-versions/:id/export?format=json` | query `format` (obrigatório) | 200 corpo JSON sem envelope | 400, 401, 404 |
| GET | `/v1/resume-versions/:id/export?format=html` | query `format` (obrigatório) | 200 `text/html` | 400, 401, 404 |
| POST | `/v1/applications/:id/interviews` | `CreateInterviewDto` | 201 `InterviewResponseDto` | 400, 401, 404, 409 |
| GET | `/v1/applications/:id/interviews` | — | 200 `InterviewResponseDto[]` | 400, 401, 404 |
| GET | `/v1/applications/:id/interviews/:interviewId` | — | 200 `InterviewResponseDto` | 400, 401, 404 |
| PATCH | `/v1/applications/:id/interviews/:interviewId` | `UpdateInterviewDto` | 200 `InterviewResponseDto` | 400, 401, 404, 409 |
| DELETE | `/v1/applications/:id/interviews/:interviewId` | — | 204 sem corpo | 400, 401, 404 |
| GET | `/v1/dashboard/summary` | — | 200 `SummaryResponseDto` | 400, 401 |
| GET | `/v1/dashboard/compensation` | — | 200 `CompensationResponseDto` | 400, 401 |

Não existe rota de export para `resumes` (`/v1/resumes/:id/export`), nem rota de
listagem geral de entrevistas, nem `DELETE`/`PATCH` de versão ou de análise. Os
dashboards não têm `404`/`409`; o único `400` é query param não permitido.

Exemplo de export JSON (`GET /v1/resume-versions/8b7c.../export?format=json`):

```json
{
  "resumeId": "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  "version": 1,
  "atsScore": 78,
  "contentSnapshot": {
    "schemaVersion": "1.0",
    "targetRole": "Desenvolvedor Backend Sênior",
    "seniority": "SENIOR",
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
        "portfolio": null
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

Exemplo de export HTML mínimo (`format=html`) — `Certificações` omitida por estar
vazia e `projects` não é renderizado:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nome Sobrenome — Currículo</title>
<style>
  body { margin: 0; background: #fff; color: #1f2933; font-family: Georgia, "Times New Roman", serif; line-height: 1.5; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  header { border-bottom: 1px solid #d9e2ec; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  p, li { font-size: 14px; }
  ul { margin: 0; padding-left: 20px; }
  .meta, .contact { font-size: 13px; color: #52606d; }
</style>
</head>
<body>
<main>
  <header>
    <h1>Nome Sobrenome</h1>
    <p class="meta">Backend Developer</p>
    <p class="contact">email@exemplo.com · +55 11 99999-9999 · São Paulo, SP, Brasil</p>
  </header>
  <section>
    <h2>Resumo</h2>
    <p>Resumo profissional...</p>
  </section>
  <section>
    <h2>Habilidades</h2>
    <ul>
      <li>Node.js — FRAMEWORK — ADVANCED — 5 anos</li>
    </ul>
  </section>
  <section>
    <h2>Experiência Profissional</h2>
    <article>
      <h3>Backend Developer — Acme</h3>
      <p class="meta">03/2021 — Atual · CLT · REMOTE · Remoto</p>
      <ul>
        <li>Reduzi a latência da API em 40%...</li>
      </ul>
    </article>
  </section>
  <section>
    <h2>Formação</h2>
    <article>
      <h3>Bacharelado em Ciência da Computação — Universidade X</h3>
      <p class="meta">02/2015 — 12/2019</p>
    </article>
  </section>
  <section>
    <h2>Idiomas</h2>
    <ul>
      <li>Inglês — ADVANCED</li>
    </ul>
  </section>
</main>
</body>
</html>
```

Exemplo de criação de entrevista (`POST /v1/applications/7a8b.../interviews`):

```json
{
  "round": 1,
  "type": "TECHNICAL",
  "scheduledAt": "2026-11-25T14:00:00.000Z",
  "durationMinutes": 60,
  "interviewerName": "Maria Silva",
  "interviewerRole": "Tech Lead",
  "meetingUrl": "https://meet.example.com/abc-123"
}
```

Resposta 201:

```json
{
  "id": "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
  "applicationId": "7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d",
  "round": 1,
  "type": "TECHNICAL",
  "scheduledAt": "2026-11-25T14:00:00.000Z",
  "durationMinutes": 60,
  "interviewerName": "Maria Silva",
  "interviewerRole": "Tech Lead",
  "meetingUrl": "https://meet.example.com/abc-123",
  "status": "SCHEDULED",
  "feedback": null,
  "outcome": "PENDING",
  "createdAt": "2026-11-19T12:00:00.000Z",
  "updatedAt": "2026-11-19T12:00:00.000Z"
}
```

Exemplo de listagem (`GET /v1/applications/7a8b.../interviews`) — array puro:

```json
[
  {
    "id": "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
    "applicationId": "7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d",
    "round": 1,
    "type": "TECHNICAL",
    "scheduledAt": "2026-11-25T14:00:00.000Z",
    "durationMinutes": 60,
    "interviewerName": "Maria Silva",
    "interviewerRole": "Tech Lead",
    "meetingUrl": "https://meet.example.com/abc-123",
    "status": "COMPLETED",
    "feedback": "Boa discussão sobre arquitetura.",
    "outcome": "PASSED",
    "createdAt": "2026-11-19T12:00:00.000Z",
    "updatedAt": "2026-11-26T18:30:00.000Z"
  }
]
```

Exemplo de atualização (`PATCH .../interviews/9d8c...`):

```json
{
  "status": "COMPLETED",
  "outcome": "PASSED",
  "feedback": "Boa discussão sobre arquitetura.",
  "meetingUrl": null
}
```

Resposta 200: mesmo `InterviewResponseDto`, com `meetingUrl: null` e `updatedAt`
posterior. `DELETE` responde 204 sem corpo.

Exemplo de summary (`GET /v1/dashboard/summary`) — cenário com 6 candidaturas,
conforme KAN-53:

```json
{
  "totalApplications": 6,
  "submitted": 5,
  "countsByStatus": {
    "SAVED": 1,
    "APPLIED": 1,
    "SCREENING": 1,
    "SCHEDULED": 0,
    "INTERVIEW": 1,
    "OFFER": 1,
    "HIRED": 0,
    "REJECTED": 1,
    "WITHDRAWN": 0,
    "CANCELLED": 0,
    "GHOSTED": 0
  },
  "responseRate": 80,
  "interviewRate": 40,
  "offerRate": 20,
  "averageTimeToFirstResponseDays": 4.5,
  "averageDaysPerStage": [
    { "status": "SAVED", "averageDays": 2.5, "sampleSize": 5 },
    { "status": "APPLIED", "averageDays": 2.75, "sampleSize": 4 },
    { "status": "SCREENING", "averageDays": 2.5, "sampleSize": 2 },
    { "status": "SCHEDULED", "averageDays": 1.5, "sampleSize": 2 },
    { "status": "INTERVIEW", "averageDays": 5, "sampleSize": 1 },
    { "status": "OFFER", "averageDays": null, "sampleSize": 0 },
    { "status": "HIRED", "averageDays": null, "sampleSize": 0 },
    { "status": "REJECTED", "averageDays": null, "sampleSize": 0 },
    { "status": "WITHDRAWN", "averageDays": null, "sampleSize": 0 },
    { "status": "CANCELLED", "averageDays": null, "sampleSize": 0 },
    { "status": "GHOSTED", "averageDays": null, "sampleSize": 0 }
  ]
}
```

Exemplo de compensação (`GET /v1/dashboard/compensation`) — 4 candidaturas BRL/MONTH
(A: 9000/10000, B: 8000/8800, C: 10000/—, D: —/7000; valores em reais, resposta em
centavos) e 1 USD/YEAR (E: 120000/132000), agrupadas por `(currency, salaryPeriod)`
com `bySeniority[]` e `bySkill[]` como campos irmãos de `byCurrency[]` no topo do
objeto (cada item repete `currency`/`salaryPeriod`):

```json
{
  "byCurrency": [
    {
      "currency": "BRL",
      "salaryPeriod": "MONTH",
      "applicationCount": 4,
      "proposed": { "count": 3, "minCents": 800000, "maxCents": 1000000, "averageCents": 900000 },
      "offered": { "count": 3, "minCents": 700000, "maxCents": 1000000, "averageCents": 860000 },
      "difference": { "absoluteCents": 90000, "percentage": 10.59, "pairedSampleSize": 2 }
    },
    {
      "currency": "USD",
      "salaryPeriod": "YEAR",
      "applicationCount": 1,
      "proposed": { "count": 1, "minCents": 12000000, "maxCents": 12000000, "averageCents": 12000000 },
      "offered": { "count": 1, "minCents": 13200000, "maxCents": 13200000, "averageCents": 13200000 },
      "difference": { "absoluteCents": 1200000, "percentage": 10, "pairedSampleSize": 1 }
    }
  ],
  "bySeniority": [
    {
      "currency": "BRL", "salaryPeriod": "MONTH", "seniority": "MID",
      "applicationCount": 2,
      "proposed": { "count": 1, "minCents": 1000000, "maxCents": 1000000, "averageCents": 1000000 },
      "offered": { "count": 1, "minCents": 700000, "maxCents": 700000, "averageCents": 700000 },
      "difference": { "absoluteCents": null, "percentage": null, "pairedSampleSize": 0 }
    },
    {
      "currency": "BRL", "salaryPeriod": "MONTH", "seniority": "SENIOR",
      "applicationCount": 2,
      "proposed": { "count": 2, "minCents": 800000, "maxCents": 900000, "averageCents": 850000 },
      "offered": { "count": 2, "minCents": 880000, "maxCents": 1000000, "averageCents": 940000 },
      "difference": { "absoluteCents": 90000, "percentage": 10.59, "pairedSampleSize": 2 }
    },
    {
      "currency": "USD", "salaryPeriod": "YEAR", "seniority": "LEAD",
      "applicationCount": 1,
      "proposed": { "count": 1, "minCents": 12000000, "maxCents": 12000000, "averageCents": 12000000 },
      "offered": { "count": 1, "minCents": 13200000, "maxCents": 13200000, "averageCents": 13200000 },
      "difference": { "absoluteCents": 1200000, "percentage": 10, "pairedSampleSize": 1 }
    }
  ],
  "bySkill": [
    {
      "currency": "BRL", "salaryPeriod": "MONTH",
      "skillId": "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f", "skillName": "Node.js",
      "applicationCount": 3,
      "proposed": { "count": 2, "minCents": 800000, "maxCents": 900000, "averageCents": 850000 },
      "offered": { "count": 3, "minCents": 700000, "maxCents": 1000000, "averageCents": 860000 },
      "difference": { "absoluteCents": 90000, "percentage": 10.59, "pairedSampleSize": 2 }
    },
    {
      "currency": "BRL", "salaryPeriod": "MONTH",
      "skillId": "1f2e3d4c-5b6a-4c8d-9e0f-1a2b3c4d5e6f", "skillName": "TypeScript",
      "applicationCount": 2,
      "proposed": { "count": 2, "minCents": 900000, "maxCents": 1000000, "averageCents": 950000 },
      "offered": { "count": 1, "minCents": 1000000, "maxCents": 1000000, "averageCents": 1000000 },
      "difference": { "absoluteCents": 100000, "percentage": 11.11, "pairedSampleSize": 1 }
    },
    {
      "currency": "USD", "salaryPeriod": "YEAR",
      "skillId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "skillName": "Kubernetes",
      "applicationCount": 1,
      "proposed": { "count": 1, "minCents": 12000000, "maxCents": 12000000, "averageCents": 12000000 },
      "offered": { "count": 1, "minCents": 13200000, "maxCents": 13200000, "averageCents": 13200000 },
      "difference": { "absoluteCents": 1200000, "percentage": 10, "pairedSampleSize": 1 }
    }
  ]
}
```

Exemplo de erro 400 — query param inválida no dashboard:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Unsupported query parameters: currency. Supported: none",
  "path": "/v1/dashboard/compensation",
  "timestamp": "2026-11-19T12:21:30.000Z"
}
```

Exemplo de erro 400 — `format` ausente no export:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "format must be one of the following values: json, html",
  "path": "/v1/resume-versions/8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d/export",
  "timestamp": "2026-11-19T12:20:00.000Z"
}
```

Exemplo de erro 400 — entrevista inválida (`durationMinutes: 0`, `round: "1"`):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "round must be an integer number",
    "durationMinutes must not be less than 1"
  ],
  "path": "/v1/applications/7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d/interviews",
  "timestamp": "2026-11-19T12:21:00.000Z"
}
```

Exemplo de erro 401 (rota autenticada sem token):

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "path": "/v1/dashboard/summary",
  "timestamp": "2026-11-19T12:22:00.000Z"
}
```

Exemplo de erro 404 (versão/candidatura/entrevista alheia ou inexistente):

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Resume version not found",
  "path": "/v1/resume-versions/8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d/export",
  "timestamp": "2026-11-19T12:23:00.000Z"
}
```

Exemplo de erro 409 (rodada duplicada):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Interview round already exists for this application",
  "path": "/v1/applications/7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d/interviews",
  "timestamp": "2026-11-19T12:24:00.000Z"
}
```

## Regras de negócio

1. **Ownership**: `userId` vem do JWT e nunca do body/query. Export filtra por
   `resume_versions.resume_id → resumes.user_id`; entrevistas filtram por
   `applications.id` + `applications.user_id`; dashboards filtram por
   `applications.user_id`. Recurso alheio ou inexistente → 404, nunca 403.
2. **Export — parâmetro**: `format` é obrigatório, `json|html`, minúsculo e único.
   Ausente/inválido/repetido → 400; nenhum default. Query extra → 400.
3. **Export — conteúdo**: JSON devolve exatamente `resumeId`, `version`, `atsScore`,
   `contentSnapshot`; `contentSnapshot` é o JSON persistido sem transformação.
   `atsScore` = `ats_analyses.score` mais recente da versão
   (`created_at DESC, id ASC`), ou `null`; a coluna `resume_versions.ats_score`
   permanece intocada e nula.
4. **Export — HTML**: renderer puro recebe o snapshot e devolve string; sem I/O,
   sem relógio, sem template engine. Estrutura e títulos fixos; seções vazias
   omitidas; escaping de `& < > " '` em texto, título e href; links apenas
   `http/https`; datas `YYYY-MM → MM/YYYY` e `YYYY-MM-DD → DD/MM/YYYY`; `current`
   → `Atual`; enums renderizados como armazenados (sem tradução); sem `projects`.
5. **Export — determinismo**: mesmas entradas → mesmos bytes. Não inserir
   `generatedAt`, timestamp de request, cache ou nome de arquivo; não alterar
   `Content-Disposition`.
6. **Export — somente leitura**: nenhuma escrita em `resume_versions` ou
   `ats_analyses`; exportar não cria análise nem atualiza `ats_score`.
7. **Entrevistas — modelo**: `interviews` sem `user_id`; ownership via candidatura.
   `round` é informado pelo cliente, inteiro ≥ 1; `unique(application_id, round)`
   impede rodada duplicada (409). Entrevista é editável e excluível.
8. **Entrevistas — validação**: `type` obrigatório; `scheduledAt` obrigatório em ISO
   8601 com timezone (normalizado a UTC); `durationMinutes` 1–1440; `status` default
   `SCHEDULED`; `outcome` default `PENDING`; `interviewerName`/`interviewerRole`
   ≤ 120; `meetingUrl` ≤ 255 e `http/https`; `feedback` texto livre; `null` só limpa
   campos opcionais.
9. **Entrevistas — PATCH**: parcial e idempotente; campos ausentes permanecem; body
   vazio → 200 sem alteração; `round` alterado para valor existente → 409; `null` em
   campo obrigatório → 400.
10. **Entrevistas — ordenação**: `round ASC, scheduled_at ASC, id ASC`; listagem é
    array puro, sem paginação, filtros ou query params.
11. **Entrevistas — desacoplamento**: CRUD não transiciona `applications.status`, não
    grava histórico e não altera datas da candidatura. Exclusão de candidatura não
    existe hoje; a FK `application_id` usa `CASCADE` para consistência futura.
12. **Summary — contagens**: `totalApplications` = todas as candidaturas;
    `countsByStatus` com os 11 status na ordem do enum e zeros explícitos (soma =
    `totalApplications`); `submitted` = candidaturas com `applied_at IS NOT NULL`;
    respondidas/entrevistadas/ofertadas conforme decisão 13, sem contadores extras.
13. **Summary — taxas**: percentual 0..100, 2 casas; `null` se `submitted = 0`.
    `REJECTED` conta como resposta; `GHOSTED` sem resposta anterior não conta;
    `WITHDRAWN`/`CANCELLED` só se houve resposta antes.
14. **Summary — tempos**: primeira resposta e etapas exatamente como na decisão 13;
    `null`/0 sem amostra; excluir `applied_at`/transição ausente e deltas negativos.
15. **Compensação — agrupamento**: sempre `(currency, salary_period)`; nunca somar
    moedas/períodos; grupos só com ao menos uma candidatura com proposto ou ofertado.
16. **Compensação — cálculos**: `proposed.averageCents`/`minCents`/`maxCents` sobre
    propostos e `offered.*` sobre ofertados (com `count`; `null` sem base);
    `difference` usa apenas a amostra pareada: `pairedSampleSize`,
    `absoluteCents` com sinal (`offered - proposed`) e `percentage` 2 casas
    calculado quando a média dos propostos pareados > 0; `null` sem pares.
17. **Dinheiro e arredondamento**: centavos como número JSON; moeda ISO 4217;
    arredondamento half-up; taxas e percentuais 2 casas; dias 2 casas; centavos
    inteiros.
18. **Somente leitura**: `GET` de export e dashboards não escreve; entrevistas só
    escrevem em `interviews`. `applications` e `application_status_history` seguem
    imutáveis fora das rotas da Sprint 4.
19. **Erros**: envelope único; mensagens claras, sem vazar dados de outro usuário;
    `ER_DUP_ENTRY` de `(application_id, round)` traduzido para 409.
20. **Swagger**: todos os endpoints, DTOs, exemplos e códigos de erro documentados em
    `/docs`, incluindo `text/html` no export.

## Modelo de dados

Migration versionada `1795824000000-CreateInterviewDomain`, classe
`CreateInterviewDomain1795824000000`, sequencial após
`1795737600000-CreateResumeDomain`. `synchronize: false` mantido. PK `varchar(36)`
com UUID; `created_at`/`updated_at` em `datetime(6)`;
`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`. FKs com nomes
explícitos idênticos em entidade e migration. Ajustar o timestamp se houver conflito,
registrando a escolha.

Entidade TypeScript `Interview`, decorada com `@Entity({ name: 'interviews' })`.
Nenhuma tabela existente é alterada; `applications`, `application_status_history`,
`resume_versions`, `ats_analyses`, `jobs`, `job_skills` e `skills` são somente
leitura.

| Tabela | Campos principais | Restrições e FKs |
|---|---|---|
| `interviews` | `id`, `application_id`, `round int`, `type enum`, `scheduled_at datetime(6)`, `duration_minutes int`, `interviewer_name varchar(120) NULL`, `interviewer_role varchar(120) NULL`, `meeting_url varchar(255) NULL`, `status enum default 'SCHEDULED'`, `feedback text NULL`, `outcome enum default 'PENDING'`, `created_at datetime(6)`, `updated_at datetime(6)` | FK `FK_interviews_application` (`application_id → applications.id`, `CASCADE`); `UNIQUE UQ_interviews_application_round (application_id, round)`; índice `IX_interviews_application_round_scheduled (application_id, round, scheduled_at, id)` para a listagem ordenada. Sem `user_id`; ownership via candidatura |

Enums novos, copiados literalmente de `spec:173-175` e criados em
`src/common/enums/` (sem duplicar):

```text
InterviewType:     HR | TECHNICAL | BEHAVIORAL | CASE | CULTURAL | FINAL
InterviewStatus:   SCHEDULED | COMPLETED | CANCELLED | NO_SHOW
InterviewOutcome:  PENDING | PASSED | FAILED
```

`InterviewStatus`/`InterviewOutcome` são independentes: não há regra que exija
`COMPLETED` para `PASSED`/`FAILED` nesta sprint (ver ambiguidade 4). O aggregate do
summary e da compensação é calculado em leitura sobre `applications`,
`application_status_history`, `interviews`, `jobs`, `job_skills` e `skills`; não há
tabela materializada, coluna derivada ou cache.

## Demo manual

**Não executada pelo time — pendente para o humano.** Pré-condição: MySQL local no
Docker, `npm run migration:run`, `npm run seed:skills`, `npm run start:dev`, Swagger
em `/docs` e dois usuários registrados (`POST /v1/auth/register`) com `TOKEN_A` e
`TOKEN_B`. Use a branch `feat/sprint-6-export-dashboard`; não criar commit nesta
etapa. Não há seed de demo (KAN-60); os dados abaixo são criados via API.

1. Como A, complete o perfil, crie um currículo e gere duas versões; crie uma vaga
   com descrição reconhecível e analise a versão 1 com `POST .../analyze`. Guarde
   `versionId`, o `contentSnapshot` de `GET /v1/resume-versions/:id` e o `score`.
2. Exporte a versão 1 em JSON: `GET /v1/resume-versions/<versionId>/export?format=json`.
   Confirme 200, `Content-Type: application/json`, exatamente quatro chaves e
   `contentSnapshot` idêntico ao do passo 1; `atsScore` igual ao `score` da análise.
3. Gere a versão 2 sem analisar e exporte em JSON: `atsScore: null`; confirme que a
   versão 1 continua com o score da análise e que `resume_versions.ats_score`
   permanece nulo para ambas.
4. Teste erros do export: sem `format` → 400; `?format=pdf` → 400; `?format=JSON` →
   400; `?format=json&format=html` → 400; `?format=json&pretty=1` → 400; sem token →
   401; `:id` inválido → 400; versão de B com `TOKEN_A` → 404; rota
   `/v1/resumes/<id>/export` → 404/405.
5. Exporte a versão 1 em HTML e salve o arquivo: confirme `text/html; charset=utf-8`,
   `<!doctype html>`, `lang="pt-BR"`, coluna única, títulos na ordem fixa, ausência de
   `<table>`, `<img>`, `<script>`, `<svg>`, `<iframe>` e de recursos externos; abra no
   navegador e confira a impressão em A4.
6. Verifique determinismo: baixe o HTML duas vezes e compare com `diff` (ou hash);
   os arquivos devem ser idênticos.
7. Teste XSS em um usuário de teste: altere o nome do perfil para
   `<script>alert(1)</script>` e um highlight para `<img src=x onerror=alert(1)>`,
   gere uma nova versão e exporte HTML. Confirme que o texto aparece escapado e que
   nenhum script roda; confirme também `&`, `"` e `'`.
8. Crie entrevistas na candidatura de A: rounds 1 (`TECHNICAL`), 2 (`HR`) e 3
   (`FINAL`), com horários fora de ordem de criação. Liste e confirme a ordem
   `round ASC, scheduledAt ASC, id ASC`; consulte uma por id; aplique `PATCH` com
   `status: COMPLETED`, `outcome: PASSED` e `feedback`; limpe `meetingUrl` com
   `null`; confirme o `updatedAt` alterado.
9. Teste entrevistas inválidas: `round: 0`, `round: "1"`, `type: "X"`, `scheduledAt`
   data-only, `durationMinutes: 0` e `1441`, `status: "X"`, `outcome: "X"`,
   `interviewerName` com 121 caracteres e `userId` no body → 400; body vazio no
   `PATCH` → 200 inalterado.
10. Crie outra entrevista com round 1 na mesma candidatura → 409; com round 1 em
    candidatura diferente → 201. Altere o round de uma entrevista para um existente →
    409. Exclua uma entrevista → 204; `GET` do id → 404; excluir de novo → 404.
11. Antes e depois do CRUD de entrevistas, capture `GET /v1/applications/<id>` e
    `GET /v1/applications/<id>/history`; confirme que status, `appliedAt`,
    `closedAt` e histórico não mudaram.
12. Prepare o funil de A com candidaturas em SAVED, APPLIED, SCREENING, INTERVIEW,
    OFFER e REJECTED, com transições reais (`PATCH .../status`) em datas distintas.
    Consulte `GET /v1/dashboard/summary` e confira à mão: contagens, `submitted`
    (apenas com `appliedAt`), as três taxas, o tempo médio até a primeira resposta e
    as médias por etapa. Confirme `null` nas bases vazias.
13. Crie uma candidatura com `offeredSalaryCents` acima do proposto, uma abaixo, uma
    só com proposto, uma só com ofertado e uma em outra moeda/periodicidade. Consulte
    `GET /v1/dashboard/compensation` e confira os grupos por `(currency,
    salaryPeriod)`, as médias, a diferença com sinal e o percentual (ausente quando
    proposto é 0 ou não há ambos). Nenhum grupo deve misturar moedas ou períodos.
14. Teste `?currency=BRL` nos dashboards → 400; sem token → 401. Com `TOKEN_B`,
    confirme 404 em export de versão de A e em todas as rotas de entrevista de A, e
    confirme que os dashboards de B não incluem dados de A (usuário sem candidaturas
    → contagens zero, taxas/tempo `null`, `countsByStatus` com 11 zeros,
    `averageDaysPerStage` com 11 itens e compensação com arrays vazios).
15. Confirme que export/dashboards não escrevem: compare contagens de linhas de
    `resume_versions`, `ats_analyses`, `applications`,
    `application_status_history` e `interviews` antes/depois de uma sequência de
    GETs. Confirme que não existe `npm run seed:demo` no fluxo desta sprint.

## Riscos

| Risco | Mitigação |
|---|---|
| XSS no HTML export | Escapar `& < > " '` em todo texto, título e href; aceitar apenas `http/https`; teste com payloads `<script>`, `<img onerror>` e esquema `javascript:`; nada de template engine ou HTML cru |
| `format` com default acidental | DTO de query com `format` obrigatório e `@IsIn(['json','html'])`; critérios e e2e para ausente, vazio, caixa alta e repetido; nenhum fallback no controller |
| Vazamento entre usuários no export/entrevistas/dashboards | Toda query parte do `userId` do JWT; export por join de `resumes`; entrevistas por `applications`; alheio/inexistente → 404; demo passos 13–14 |
| `atsScore` divergente do score real | Sempre derivar de `ats_analyses` (`created_at DESC, id ASC`), nunca de `resume_versions.ats_score`; teste com múltiplas análises e com versão sem análise |
| HTML não determinístico | Renderer puro, sem relógio/random/locale; datas formatadas manualmente; teste de igualdade byte a byte |
| Renderer interpretando conteúdo do usuário | Escaping centralizado em uma única função, com unit tests; proibição de `innerHTML`-like/replace de tags e de sanitização por regex permissiva |
| Fórmulas do dashboard divergirem entre service e teste | Constantes exportadas (`RESPONDED_STATUSES`, `INTERVIEW_REACHED_STATUSES`, `OFFER_REACHED_STATUSES`) e helpers puros testáveis; fixture única usada no e2e e nos unitários |
| `submitted` contado de forma errada (`status <> SAVED`) | Denominador definido como `applied_at IS NOT NULL`; `SAVED → CANCELLED` fica fora; critério explícito e fixture |
| Arredondamento inconsistente | Regra única (`Math.round` half-up; taxas e percentuais 2 casas, dias 2 casas, centavos inteiros) e testes de fronteira (0,3333; 10,5555; valores negativos de diferença) |
| Divergência de nomes de campos entre sprint e ADR | Formatos seguem `docs/adr/0006-sprint-6-export-dashboard.md`: `submitted`, `averageTimeToFirstResponseDays`, `averageDaysPerStage`, `difference.absoluteCents`/`percentage`/`pairedSampleSize`, com `bySeniority`/`bySkill` no topo |
| Mistura de moedas ou periodicidades na compensação | Chave de grupo sempre `(currency, salary_period)`; nenhuma soma entre grupos; teste com BRL/MONTH, BRL/YEAR e USD/MONTH |
| Percentual com proposto 0 ou sem ambos | Cálculo só com `proposed > 0` e `both`; `null` explícito; teste dedicado |
| Duplicidade de rodada em corrida | `UNIQUE(application_id, round)` + tradução de `ER_DUP_ENTRY` para 409; teste concorrente no e2e |
| Entrevista alterando o funil por engano | Service de entrevistas não toca `applications`/histórico; teste que compara estado antes/depois |
| `PATCH` de entrevista aceitando `null` em campo obrigatório | `assertNoForcedNull`/validadores por campo; critério e demo passo 9 |
| Exclusive ownership check lento ou N+1 nos dashboards | Consultas agregadas no banco por `user_id`, com `GROUP BY`/joins; índices existentes (`IX_applications_user_status`, `IX_application_status_history_app_changed`); volume do MVP é pequeno, mas evitar loop por candidatura |
| FK de entrevista impedir operações futuras | `ON DELETE CASCADE` alinhado a `application_status_history`; não há `DELETE /applications` hoje |
| Coluna `resume_versions.ats_score` voltar a ser escrita | Export é read-only; nenhuma migration altera a coluna; teste de imutabilidade e revisão |
| Seed da Fase 4 invadir a Sprint 6 | Escopo e conflito explícitos; nenhum script/Yet another seed é criado; demo manual |
| Divergência entre `job_skill` da spec e `job_skills` real | Consultas usam a tabela existente `job_skills`; documentado na Resolução de conflitos |
| E2E dependente de MySQL indisponível | `docker compose up -d` em `kandid_api/`; CI usa service container; documentar no fechamento |

## Definition of Done

- [ ] `docs/sprints/sprint-06.md` escrito com Escopo, Decisões, Resolução de conflitos, critérios Given/When/Then, contratos e exemplos, regras, modelo de dados, demo manual, riscos, DoD, tarefas, ambiguidades e referências.
- [ ] KAN-50 e KAN-51 implementados conforme os critérios, com export JSON e HTML na branch `feat/sprint-6-export-dashboard` (base `667bf83`).
- [ ] KAN-52 implementado com tabela `interviews`, enums novos, entidade, DTOs, service, controller, Swagger e as 5 rotas aninhadas.
- [ ] KAN-53 e KAN-54 implementados com agregações somente leitura, escopadas por usuário, sem query params.
- [ ] Nenhuma rota de export em `/v1/resumes`; nenhuma escrita em `applications`, `application_status_history`, `resume_versions` ou `ats_analyses` pelas rotas novas.
- [ ] Migration `1795824000000-CreateInterviewDomain` criada; cadeia local `migration:run` → `migration:revert` → `migration:run` → `migration:show` concluída e `schema:log` via CLI sem drift.
- [ ] Testes unitários do renderer HTML (estrutura, escaping, links, datas, determinismo) e dos cálculos de summary/compensação (taxas, denominadores, arredondamento, grupos por moeda/período, `null` sem base) escritos e passando.
- [ ] Testes e2e cobrindo export JSON/HTML (incluindo 400/401/404 e XSS), CRUD de entrevistas (incluindo 409, ordenação e ownership) e ambos os dashboards (incluindo isolamento, query inválida e read-only).
- [ ] `npm run lint`, `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npm test` e `npm run test:e2e` (com MySQL) executados com sucesso.
- [ ] Swagger em `/docs` com todos os contratos desta sprint, DTOs, exemplos, `text/html` e códigos de erro.
- [ ] Nenhum segredo introduzido; `.env` não lido; nenhum seed de demo, README ou release nesta sprint.
- [ ] `git diff --check` limpo e revisão read-only executada, com achados registrados.
- [ ] Demo manual executada pelo humano, incluindo determinismo do HTML, XSS, isolamento entre usuários e ausência de escrita nos GETs.
- [ ] Commit/push/PR/merge/deploy aguardam aprovação humana, conforme `AGENTS.md`.

## Tarefas

- [ ] Escrever `docs/sprints/sprint-06.md` (planejamento, critérios, contratos, regras, modelo, demo, riscos e ambiguidades).
- [ ] Architect: validar a migration, o formato das respostas de export/dashboards e as sete ambiguidades; registrar decisões finais em ADR quando houver mudança.
- [ ] Revisar diferenças pendentes entre `sprint-06.md` e o ADR 0006 no portão humano; R1–R13 já decididos pelo tech lead.
- [ ] Criar enums `InterviewType`, `InterviewStatus` e `InterviewOutcome` em `src/common/enums/`, copiados da spec.
- [ ] Migration `1795824000000-CreateInterviewDomain` com tabela `interviews`, FK explícita, `UNIQUE(application_id, round)` e índice de listagem.
- [ ] Entidade `Interview` e relação com `Application`, sem `user_id`.
- [ ] DTOs `CreateInterviewDto`, `UpdateInterviewDto` e `InterviewResponseDto`; nenhum DTO aceita `userId`/`applicationId`/timestamps.
- [ ] `InterviewsService` e `InterviewsController` com `JwtAuthGuard`, `@CurrentUser()`, `ParseUUIDPipe`, ownership via candidatura, ordenação e 409.
- [ ] DTO de query do export (`format` obrigatório e whitelist) e rota `GET /v1/resume-versions/:id/export`.
- [ ] `ResumeExportService`: carregar versão por ownership, resolver `atsScore` da análise mais recente e montar o corpo JSON exato.
- [ ] Renderer puro de HTML em `src/modules/resumes/export/` (sem template engine), com escaping, links seguros, datas e títulos fixos.
- [ ] `DashboardService`/helpers puros e controllers de `/v1/dashboard/summary` e `/v1/dashboard/compensation`, com agregações por `userId` e por moeda/período.
- [ ] Testes unitários de renderer e métricas; e2e de export, entrevistas, dashboards, isolamento e read-only.
- [ ] Swagger completo e exemplos de request/response/erro.
- [ ] `npm run lint`, `tsc`, `npm run build`, `npm test`, `npm run test:e2e`, cadeia de migration e `git diff --check`.
- [ ] Humano: validar as ambiguidades, executar a demo manual e decidir commit/PR/merge/deploy.

## Pendente de validação humana/architect

Os **rulings R1–R13 do tech lead (2026-11-19) estão decididos** e registrados na
tabela de Resolução de conflitos e no ADR 0006; não são mais pendências. As decisões
abaixo estão **adotadas para implementação** e não bloqueiam o desenvolvimento.
Nenhuma é irreversível: o humano/architect confirma ou ajusta no portão final, com
ADR quando houver mudança. As pendências reais estão marcadas como `Pendente:`.

1. **Unicidade e origem de `round` (ponto a)**
   - Decisão adotada: `UNIQUE(application_id, round)` e `round` informado pelo cliente
     (inteiro ≥ 1), sem auto-incremento. Rodada duplicada → 409. Reagendar a mesma
     rodada exige editar a entrevista existente ou excluí-la antes de recriar.
   - Alternativas rejeitadas: sem UNIQUE (permite duas "rodada 1" indistinguíveis) e
     `round` auto-incrementado no servidor (corrida e perda da intenção do usuário,
     além de tornar o `PATCH` de `round` impossível).
   - Pendente: confirmar se entrevistas canceladas devem liberar o número da rodada
     automaticamente (hoje é preciso excluir) e se há limite superior de `round`.

2. **Fórmulas do summary (ponto b)**
   - Decisão adotada: `submitted` = `applied_at IS NOT NULL`; respostas =
     `SCREENING|SCHEDULED|INTERVIEW|OFFER|HIRED|REJECTED` (status atual ou histórico);
     entrevista = tem entrevista ou alcançou `INTERVIEW|OFFER|HIRED`; oferta =
     alcançou `OFFER|HIRED`; taxas percentuais 0..100 sobre `submitted` (R1); tempo até primeira resposta de
     `applied_at` (00:00 UTC, com fallback para a transição `→ APPLIED`, R3) até a
      primeira transição de resposta; etapas com âncora sintética `(status inicial,
      created_at)`
     com segmento aberto final excluído, `SAVED` incluído e `sampleSize` por etapa (R4).
   - Alternativas rejeitadas: denominador "todas as candidaturas" (inclui SAVED e
     subestima conversão); taxa de oferta sobre respostas (mede outra coisa); média
     de percentuais por etapa; contar o tempo no status atual até "agora" (muda a
     cada request e quebra determinismo).
   - Pendente: confirmar (i) se `REJECTED` deve mesmo contar como resposta, (ii) se
     `GHOSTED` deve contar como não resposta mesmo com contato anterior sem
     transição, (iii) se o tempo no status atual deve aparecer em história futura.
     A unidade percentual (R1), a união (R2) e o fallback/âncora (R3/R4) estão decididos.

3. **Compensação: agrupamento e bases (ponto c)**
   - Decisão adotada: agrupar por `(currency, salary_period)`, nunca só por moeda;
     médias separadas para proposto, ofertado e diferença; diferença
     `offered - proposed` com sinal; percentual só com `proposed > 0`; candidaturas
     sem valor saem apenas das médias correspondentes; senioridade de
     `jobs.seniority` com bucket `null`; skills de todas as `job_skills` (sem filtrar
     `is_required`), com contribuição múltipla.
   - Alternativas rejeitadas: agrupar só por moeda (mistura mensal e anual);
     normalizar tudo para mensal (exige premissas de conversão não previstas);
     usar `min`/`max` da vaga quando a candidatura não tem valor (inventa dado);
     percentual calculado como razão das médias (dá resultado diferente da média dos
     percentuais); média por skill apenas de skills obrigatórias (perde sinal).
   - Pendente: confirmar o tratamento de `is_required` em `job_skills` e se
     `absoluteCents` deve continuar com sinal (decisão atual) ou virar magnitude com campo
     de direção. A chave `(currency, salary_period)` e a média pareada de percentuais
     estão decididas no ADR 0006.

4. **Entrevistas: defaults, validação e ordem (ponto d)**
   - Decisão adotada: `status` default `SCHEDULED`, `outcome` default `PENDING`;
     `scheduled_at` obrigatório com timezone; `duration_minutes` 1–1440; `round` ≥ 1;
     `type` obrigatório; `PATCH` parcial com body vazio como no-op; ordem
     `round ASC, scheduled_at ASC, id ASC`; `null` limpa só campos opcionais.
   - Alternativas rejeitadas: exigir `scheduled_at` no futuro (impede registrar
     entrevista já realizada/importada); acoplar `outcome` a `status`
     (`COMPLETED` ⇒ `PASSED|FAILED`) sem previsão na spec; auto-incrementar `round`;
     retornar envelope paginado para uma lista curta; aceitar `null` em campo
     obrigatório.
   - Pendente: Pendente apenas: limite superior de `round` e liberação de rodada cancelada
     (item 1). Limite de 1440 minutos, `PATCH` vazio → 200 e agendamento no passado
     estão decididos; `createdAt`/`updatedAt` aparecem na resposta (R8) e
     `COMPLETED` não exige `outcome` diferente de `PENDING`.

5. **Origem do `atsScore` no export**
   - Decisão adotada: análise mais recente da **versão**, independentemente do
     `jobId` da análise ou da versão; sem análise → `null`.
   - Alternativa rejeitada: usar apenas a análise do `jobId` da versão (deixaria
     `null` em versões com várias análises ou com `jobId` nulo).
   - Sem pendência: análise mais recente da versão, conforme ADR 0005/0006
     (mesmo com vagas diferentes); mudança exige ADR.

6. **Detalhes do contrato HTML**
   - Decisão adotada: `<style>` no `<head>` conta como CSS inline; sem
     `Content-Disposition`/nome de arquivo; `projects` não é renderizado; seções
     vazias são omitidas; datas em `MM/YYYY`/`DD/MM/YYYY`; `current` → `Atual`; links
     `http/https` viram âncora, demais esquemas ficam como texto; enums sem tradução;
     `headline` com fallback para `targetRole`.
   - Alternativas rejeitadas: `style=""` por elemento (duplicação e diff ruidoso);
     renderizar `projects` (fora da lista fixa de títulos); criar seções vazias com
     placeholder; embutir `atsScore`/metadados no HTML; permitir qualquer esquema de
     URL em `<a>`.
   - Pendente: apenas inclusão futura de `Projetos` como sétimo título.
     `Content-Disposition`/nome de arquivo está decidido como ausente.

7. **Forma das respostas novas**
   - Decisão adotada: export JSON sem envelope e com exatamente quatro chaves; HTML
     cru; entrevistas em array puro; dashboards em objeto puro; nenhum dos novos
     endpoints aceita query params além de `format`; query extra → 400.
   - Alternativas rejeitadas: envolver tudo em `{ data, meta }` (a spec não pede
     paginação e o export é um documento); paginar entrevistas; aceitar filtros de
     período nos dashboards sem contrato.
   - Pendente: apenas filtros futuros de dashboard.
     Formato sem envelope está decidido; filtros entram em história futura.

## Referências

- `docs/prompt-kandid.md:135-158` — modelo de `application`,
  `application_status_history`, `interview`, `resume`, `resume_version` e
  `ats_analysis`.
- `docs/prompt-kandid.md:159-176` — enums, incluindo `ApplicationStatus`,
  `InterviewType`, `InterviewStatus` e `InterviewOutcome`.
- `docs/prompt-kandid.md:178-203` — máquina de estados e regras de transição
  (histórico append-only, `applied_at`, `closed_at`).
- `docs/prompt-kandid.md:306-362` — contrato do snapshot e imutabilidade da versão.
- `docs/prompt-kandid.md:363-372` — export JSON/HTML: rotas, metadados, requisitos do
  HTML e `format` obrigatório.
- `docs/prompt-kandid.md:374-423` — API `/v1`, incluindo entrevistas, export e
  dashboards.
- `docs/prompt-kandid.md:425-436` — convenções de API (auth, validação, ownership,
  paginação, datas, erros, status HTTP, Swagger, transações).
- `docs/prompt-kandid.md:526-534` — Fase 4 (entrevistas, dashboards e seed).
- `docs/prompt-kandid.md:536-557` — testes mínimos (incluindo export) e regra do seed
  de demo.
- `docs/prompt-kandid.md:559-577` — Definition of Done, restrições finais e regra de
  não inventar entidades/endpoints.
- `docs/backlog.md:134-142` — E5 e histórias KAN-50 a KAN-54.
- `docs/backlog.md:144-150` — E6, com KAN-60 (seed) na Sprint 7.
- `docs/sprints/sprint-05.md` — padrão de documento, contrato do snapshot, decisão do
  `atsScore` e adiamento do export.
- `docs/adr/0005-sprint-5-resumes-ats.md` — imutabilidade da versão e `ats_score`
  nulo.
- `docs/adr/0006-sprint-6-export-dashboard.md` — fonte técnica canônica das
  fórmulas, contratos, modelo de `interviews`, índices e rulings R1–R13.
- `docs/sprints/sprint-04.md` — padrão de `applications`, histórico e compensação;
  decisão de não comparar proposto × ofertado naquela sprint.
- `AGENTS.md` — branches curtas, TDD quando aplicável, qualidade e proibição de
  commit/push/deploy sem aprovação humana.
