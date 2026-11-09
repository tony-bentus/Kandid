# kandid_api

Aplicação NestJS do Kandid. A visão geral, arquitetura, setup e roadmap estão no
[README da raiz](../README.md).

## Comandos rápidos

```bash
docker compose up -d
cp .env.example .env
npm ci
npm run migration:run
npm run start:dev
```

Validação:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
```

- API: `http://localhost:3000/v1`
- Health: `http://localhost:3000/v1/health`
- Swagger: `http://localhost:3000/docs`

As instruções específicas da aplicação estão em [`AGENTS.md`](AGENTS.md).
