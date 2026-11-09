# Backlog — Kandid

Status: `Planejado` | `Em andamento` | `Concluído` | `Bloqueado`

## Épicos

| ID | Épico | Sprint | Status |
|---|---|---|---|
| E0 | Fundação, agentes e CI/CD | 0 | Em andamento |
| E1 | Autenticação e perfil | 1–2 | Planejado |
| E2 | Empresas, recrutadores e vagas | 3 | Planejado |
| E3 | Candidaturas e máquina de estados | 4 | Planejado |
| E4 | Currículos e motor ATS | 5 | Planejado |
| E5 | Export, dashboard e entrevistas | 6 | Planejado |
| E6 | Hardening e release v1.0.0 | 7 | Planejado |

## Histórias

### E0 — Sprint 0

| ID | História | Status |
|---|---|---|
| KAN-1 | Reestruturar repositório em monorepo na raiz | Concluído |
| KAN-2 | Configurar agentes, comandos e permissões | Concluído |
| KAN-3 | Configurar env, TypeORM, migrations e Docker Compose | Concluído |
| KAN-4 | Adicionar Swagger, validação global e filtro de erros | Concluído |
| KAN-5 | Criar `GET /v1/health` | Concluído |
| KAN-6 | CI com lint, build, testes e MySQL | Concluído (aguardando 1º PR) |
| KAN-7 | CD para o ambiente demo | Bloqueado (infra manual) |
| KAN-8 | Spike e ADR de banco de dados | Bloqueado (conta externa) |

### E1 — Autenticação e perfil

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-10 | Registrar usuário | 1 | Planejado |
| KAN-11 | Autenticar com JWT | 1 | Planejado |
| KAN-12 | Consultar usuário autenticado | 1 | Planejado |
| KAN-13 | Criar e atualizar perfil | 2 | Planejado |
| KAN-14 | CRUD de experiências e bullets | 2 | Planejado |
| KAN-15 | Catálogo e vínculo de skills | 2 | Planejado |
| KAN-16 | Formação, certificações e idiomas | 2 | Planejado |

### E2 — Pipeline

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-20 | CRUD de empresas | 3 | Planejado |
| KAN-21 | CRUD de recrutadores | 3 | Planejado |
| KAN-22 | CRUD de vagas com stack e faixa | 3 | Planejado |

### E3 — Candidaturas

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-30 | Criar candidatura para vaga | 4 | Planejado |
| KAN-31 | Transicionar status com histórico | 4 | Planejado |
| KAN-32 | Registrar valores proposto e ofertado | 4 | Planejado |
| KAN-33 | Filtrar e paginar candidaturas | 4 | Planejado |

### E4 — Currículo e ATS

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-40 | Criar currículo e gerar versão | 5 | Planejado |
| KAN-41 | Extrair keywords da vaga | 5 | Planejado |
| KAN-42 | Calcular score e checks | 5 | Planejado |
| KAN-43 | Persistir e consultar análise | 5 | Planejado |

### E5 — Export e dashboard

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-50 | Exportar currículo em JSON | 6 | Planejado |
| KAN-51 | Exportar currículo em HTML | 6 | Planejado |
| KAN-52 | CRUD de entrevistas | 6 | Planejado |
| KAN-53 | Dashboard de funil | 6 | Planejado |
| KAN-54 | Dashboard de compensação | 6 | Planejado |

### E6 — Hardening

| ID | História | Sprint | Status |
|---|---|---|---|
| KAN-60 | Seed de demonstração | 7 | Planejado |
| KAN-61 | CodeQL, Dependabot e Sentry | 7 | Planejado |
| KAN-62 | README de portfólio | 7 | Planejado |
| KAN-63 | Release v1.0.0 | 7 | Planejado |
