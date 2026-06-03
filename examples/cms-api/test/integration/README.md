# cms-api integration tests

These tests exercise the cms-api HTTP surface end-to-end against a **real
MongoDB replica set** (transactions require a replica set), booting the full
NestJS + Fastify application through `@nestjs/testing` and driving it with
`app.inject(...)`.

## Running

**In Docker (recommended — spins up MongoDB for you):**

```bash
# from examples/cms-api
yarn test:integration:docker
```

This builds `test/integration/Dockerfile.integration`, starts a `mongo:8`
replica set via `test/integration/docker-compose.yml`, runs the suite, and tears
everything down.

**Against an already-running MongoDB replica set:**

```bash
# from examples/cms-api
MONGODB_CONNECTION_STRING="mongodb://localhost:27017/?replicaSet=rs0" yarn test:integration
```

Each run targets a uniquely-named database (`integration_test_<timestamp>`) that
is dropped on teardown.

## What's covered

All specs live under [`specs/`](./specs). Each drives the real controllers and
verifies the result both in the HTTP response and directly in MongoDB.

| Suite | Surface under test |
| --- | --- |
| `specs/status.integration-spec.ts` | health/status endpoint |
| `specs/account.integration-spec.ts` | account CRUD |
| `specs/organization.integration-spec.ts` | organization CRUD + delete hook |
| `specs/api-key.integration-spec.ts` | API key issuance/scoping |
| `specs/todo-list.integration-spec.ts` | todo-list CRUD + cascade delete + audit trail |
| `specs/todo-item.integration-spec.ts` | todo-item CRUD |
| `specs/note.integration-spec.ts` | versioned note CRUD: optimistic concurrency (409), revision history |

## Layout

```
test/integration/
├── Dockerfile.integration   # builds the monorepo + runs the suite
├── docker-compose.yml       # mongo:8 replica set + the test runner
├── jest-integration.json    # jest config (ts-jest, 60s timeout)
├── tsconfig.json            # ts-jest tsconfig (declaration off, explicit rootDir)
├── setup.ts                 # boots the NestJS app + Mongo client, stubs auth
└── specs/                   # the *.integration-spec.ts files
```

## Adding a spec

1. Add a `*.integration-spec.ts` under `specs/`.
2. Use `createTestContext()` / `teardownTestContext()` from `../setup` to get a
   booted app (`ctx.app`), a raw Mongo handle (`ctx.db`), and a seeded test
   principal/account/organization.

The shared NestJS app + Mongo client are built in `setup.ts`.
