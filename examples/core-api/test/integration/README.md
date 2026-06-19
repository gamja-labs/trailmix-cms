# core-api integration tests

These tests exercise the core-api HTTP surface end-to-end against a **real
MongoDB replica set**, driving the genuine better-auth routes
(`/api/auth/sign-up/email`, `/api/auth/sign-in/email`, the organization plugin)
and forwarding the session cookies they issue. **Nothing about auth is stubbed**,
so the suite verifies the real sign-up/sign-in flow and the `@Roles` / `@OrgRoles`
guards exactly as they run in production.

## How it boots the app

core-api's dependency tree (better-auth + `@thallesp/nestjs-better-auth` +
`@trailmix-cms/core`) is **ESM-only**, which jest's in-process module runtime
can't load cleanly under Yarn PnP. So instead of importing the app into jest,
the suite **builds it and runs the real `dist/main.js` as a child process** —
letting Node + the PnP ESM loader handle the module graph exactly as production
does — and drives it over HTTP with `fetch`. jest itself only runs the test
file (plain CommonJS), which talks to the server and reads/seeds Mongo directly.

## Running

**In Docker (recommended — spins up MongoDB for you):**

```bash
# from examples/core-api
yarn test:integration:docker
```

This builds `test/integration/Dockerfile.integration`, starts a `mongo:8`
replica set via `test/integration/docker-compose.yml`, runs the suite, and tears
everything down.

**Against an already-running MongoDB replica set:**

```bash
# from examples/core-api
MONGODB_CONNECTION_STRING="mongodb://localhost:27017/?replicaSet=rs0" yarn test:integration
```

Each run targets a uniquely-named database (`integration_test_<timestamp>`) that
is dropped on teardown. The server binds an OS-assigned free port, and
`BETTER_AUTH_SECRET` is generated per run if unset. `test:integration` builds the
app first (via the `pretest:integration` hook) so `dist/main.js` is current.

## What's covered

`specs/auth.integration-spec.ts`:

| Area | Assertions |
| --- | --- |
| Sign-up / sign-in | sign-up creates the user + auto-signs-in; `GET /me` authenticates with the cookie; unauthenticated `GET /me` → 401; sign-in succeeds; wrong password → 401; `@OptionalAuth` public route works signed-in and anonymous |
| `@Roles(['admin'])` | regular user → 403; user promoted to `role: 'admin'` → 200 |
| `@OrgRoles(['owner','admin'])` | no active org → 403; org creator (owner) after `set-active` → 200; plain member → 403 |

## Layout

```
test/integration/
├── Dockerfile.integration   # builds the monorepo + runs the suite
├── docker-compose.yml       # mongo:8 replica set + the test runner
├── jest-integration.json    # jest config (ts-jest, CommonJS)
├── tsconfig.json            # ts-jest tsconfig (declaration off, explicit rootDir)
├── setup.ts                 # spawns the built server as a child process + Mongo client
├── helpers.ts               # cookie-jar fetch client + better-auth sign-up/sign-in helpers
└── specs/                   # the *.integration-spec.ts files
```
