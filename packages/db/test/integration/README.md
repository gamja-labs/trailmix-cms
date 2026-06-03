# `@trailmix-cms/db` integration tests

These tests exercise every main feature of the db library against a **real
MongoDB replica set** (transactions require a replica set), wiring the library's
real NestJS providers through `@nestjs/testing`.

## Running

**In Docker (recommended — spins up MongoDB for you):**

```bash
# from packages/db
yarn test:integration:docker
```

This builds `Dockerfile.integration`, starts a `mongo:8` replica set via
`docker-compose.yml`, runs the suite, and tears everything down.

**Against an already-running MongoDB replica set:**

```bash
# from packages/db
MONGODB_CONNECTION_STRING="mongodb://localhost:27017/?replicaSet=rs0" yarn test:integration
```

Each run targets a uniquely-named database (`db_integration_test_<timestamp>`)
that is dropped on teardown.


## Adding a feature to the suite

1. If you need a new test entity, add its Zod schema to `entities.ts`.
2. Add a concrete collection class wiring it to the relevant base class in
   `collections.ts`, and register it in `testCollectionServices`.
3. Add a `*.integration-spec.ts` under `specs/`.

The shared NestJS module + Mongo client are built in `setup.ts`.
