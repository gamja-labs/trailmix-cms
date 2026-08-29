# Full-stack e2e environment (core-api + core-web)

A Docker Compose environment that **builds core-api and core-web from monorepo source on every
run** and drives the real auth and API features — first over HTTP, then through the actual SPA in
a headless browser. Nothing is stubbed and nothing is reused from your working tree's
`node_modules` / `dist`.

```bash
./test/e2e/run.sh          # or: yarn test:e2e
```

## What comes up

| Service | Port(s) | What it is |
| --- | --- | --- |
| `mongodb` | 27017 | `mongo:8` as a single-node replica set (`rs0`) — the revisable collections use transactions, which need a replica set even for one node |
| `core-api` | 4001 | the real NestJS app, built from source |
| `core-web` | 8080, 8081 | nginx: the prerendered SPA on `:8080`, a transparent proxy to core-api on `:8081` |
| `e2e` | — | Playwright + headless Chromium |

### Why core-web fronts the API too

better-auth is **cookie**-based. Locally, core-web (`localhost:5175`) and core-api
(`localhost:4001`) are different *origins* but the same *site*, so the default `SameSite=Lax`
session cookie rides along on the SPA's credentialed XHRs.

Two containers with distinct hostnames (`core-web` / `core-api`) would be cross-**site**. The
cookie would then need `SameSite=None; Secure`, and `Secure` is unreachable over plain http — auth
would fail for reasons that have nothing to do with the code under test.

So the `core-web` container is the browser-facing edge for both: SPA on `:8080`, proxy to core-api
on `:8081`. Same host, two ports — exactly the local dev relationship, and the same shape as
production behind a real edge. `BETTER_AUTH_URL` points at `http://core-web:8081` and nginx
forwards the original `Host`, so better-auth sees the URL it was configured with.

## What "fresh build" means here

- `yarn install --immutable` against the lockfile, then `yarn build` over the whole workspace.
- **The OpenAPI spec and the typed client are regenerated.** `examples/core-api/docs/api-json.json`
  and `examples/core-web/src/client/Api.ts` are both git-ignored, so a fresh clone doesn't have
  them. The image builds the spec (`GENERATE_SPEC=true` swaps in `@trailmix-cms/db`'s stub
  connection, so no MongoDB and no real secret are needed), generates the client from it, and only
  then builds the SPA. A drift between core-api's routes and core-web's client shows up as a
  build failure rather than a mystery at runtime. Both are `.dockerignore`d as well, so the copies
  sitting in your working tree never enter the build context — otherwise a stale local client
  could stand in for the regenerated one and hide the very drift this is meant to catch.
- `.dockerignore` keeps `node_modules/`, `dist/`, `*.tsbuildinfo` and every `.env*` out of the
  build context — your local `.env`, including its real database credentials, never reaches an
  image.
- The runner's `@playwright/test` is pinned to an exact version. It is installed with `npm install`
  and no lockfile (deliberately outside the yarn workspace graph), so a caret range would let the
  browser build drift between cold rebuilds.
- `run.sh` runs `down -v` before and after, so each run starts on an empty database.

## What's covered

`specs/api.spec.ts` — core-api directly, over the same edge origin the browser uses:

| Area | Assertions |
| --- | --- |
| Public routes | `GET /status` anonymous; `GET /public/greeting` generic when signed out, personalized when signed in |
| Sign-up / sign-in | sign-up creates the user and auto-signs-in; the cookie authenticates `GET /me`; anonymous `GET /me` → 401; sign-in succeeds; wrong password → 401; `GET /account/whoami` reflects the request-attached user |
| Notes (revisable) | create → v0; list and get-by-id; update → v1; **stale version → 409** and the document is unchanged; revision history contains `create` + `update`; version-checked delete, then 404; anonymous access → 401 |
| `@Roles(['admin'])` | regular user → 403; after `POST /test/promote-admin` → 200; after demote → 403 again |
| `@OrgRoles(['owner','admin'])` | no active org → 403; org creator after `set-active` → 200 |

`specs/web.spec.ts` — one serial journey through the real UI in one browser context, covering
what an HTTP client cannot: the generated client, credentialed CORS, the trusted-origin config,
the router guard, and the cookie surviving real navigations.

1. Signed-out login page renders live `GET /status` + `GET /public/greeting` results.
2. Sign-up through the form → router guard admits → Dashboard shows `GET /me` and a personalized greeting.
3. Notes: create (v0) → edit (v1) → revision history shows both entries → delete.
4. Admin: the role-gated card shows the 403, then "Promote me to admin" flips it to the payload.
5. Sign out → the guard bounces a direct navigation back to `/login`.

## Layout

```
test/e2e/
├── run.sh              # build → run → tear down; exits with the suite's status
├── docker-compose.yml  # mongo + core-api + core-web(edge) + the Playwright runner
├── Dockerfile          # one file, two targets (core-api, core-web) sharing the build stage
├── Dockerfile.e2e      # the Playwright runner (deliberately outside the yarn workspace graph)
├── nginx/default.conf  # :8080 SPA, :8081 proxy to core-api
├── playwright.config.ts
├── fixtures/api.ts     # cookie-isolated API clients + better-auth helpers
└── specs/
    ├── api.spec.ts
    └── web.spec.ts
```

## Working on the suite

Iterate on the tests without rebuilding the apps:

```bash
cd test/e2e
docker compose up -d core-web                       # brings up mongo + core-api + the edge
docker compose run --rm e2e npx playwright test specs/api.spec.ts
docker compose run --rm e2e npx playwright test --grep "notes"
docker compose down -v
```

Failures leave a trace, screenshot and video under `test/e2e/test-results/`, and an HTML report at
`test/e2e/report/index.html` (`npx playwright show-report test/e2e/report`).

### Docker Desktop on WSL

If your distro doesn't have **Settings → Resources → WSL Integration** enabled, there is no
`/var/run/docker.sock` and the Linux `docker` CLI reports `Cannot connect to the Docker daemon`
even though Docker Desktop is running. `run.sh` detects that and falls back to `docker.exe` with
`wslpath`-translated paths, so it keeps working — but enabling the integration is the better fix,
and raw `docker compose` commands (the iteration recipe above) need it.

Poke at the running stack from the host by publishing ports — add a `ports:` entry to the
`core-web` service (e.g. `8080:8080` and `8081:8081`) and browse `http://localhost:8080`.
They are unpublished by default so a run never collides with a dev server.

## In CI

`.github/workflows/ci.yml` runs the suite as the **Full-stack E2E Tests** job on every push to
`main`, alongside the two integration jobs, and `bump` waits on it before releasing. The job shells
out to `bash test/e2e/run.sh` — `bash` rather than `./` so the checkout's file mode can't break it,
and with `shell: bash` so `pipefail` is in effect and the `tee` cannot swallow a failing exit code.
The log, the HTML report and any traces are uploaded as the `e2e-test-results` artifact.

## Relationship to the other suites

- `packages/db/test/integration` — the db package against a real Mongo, no HTTP.
- `examples/core-api/test/integration` — core-api's HTTP surface, jest driving the built
  `dist/main.js` as a child process. Faster; no frontend, no browser.
- **this suite** — both apps built and running as containers, exercised through the browser as
  well as the API. The slowest and the most complete.
