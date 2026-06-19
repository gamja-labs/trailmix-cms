# core-web

A small Vue 3 frontend for the [`core-api`](../core-api) example. It demonstrates how a browser
app talks to a Trailmix **core** backend:

- 🔐 **better-auth** email/password authentication (sign-up + sign-in), using the
  [`better-auth/vue`](https://www.better-auth.com/docs/integrations/vue) client — **no Clerk**.
  This is the key difference from the [`cms-web`](../cms-web) example, which uses Clerk.
- 🧭 A session-aware **router guard** that redirects unauthenticated users to the login page.
- 📇 An auto-generated, **type-safe API client** (`src/client/Api.ts`) created from core-api's
  OpenAPI spec via [`swagger-typescript-api`](https://github.com/acacode/swagger-typescript-api).
- 📝 A **revisable notes** screen — versioned, optimistic-concurrency CRUD (HTTP 409 on stale
  writes) plus per-note revision history, backed by core-api's `RevisableCollection`.
- 🩺 A **dashboard** that calls one endpoint per auth style: `/status` (public),
  `/public/greeting` (optional auth), and `/me` (session required).
- 🎨 The same dark SCSS theme as `cms-web`.

## How auth works here

core-api uses **cookie sessions** (better-auth), not bearer tokens. Two pieces make cross-origin
auth work between this app (`http://localhost:5175`) and the API (`http://localhost:4001`):

1. **The API allows credentialed CORS for this origin.** core-api's `main.ts` calls
   `app.enableCors({ origin: WEB_ORIGIN, credentials: true })`, and `WEB_ORIGIN` is also added to
   better-auth's `trustedOrigins`. Both default to `http://localhost:5175`.
2. **This app sends credentials with every request.** The better-auth client does this for its own
   calls, and our generated API client is constructed with `credentials: 'include'`
   (see `src/lib/api.ts`), so the browser attaches the better-auth session cookie.

## Prerequisites

- Node.js `^20.19.0 || >=22.12.0`
- Yarn (this is a workspace package — install from the repo root)
- A running [`core-api`](../core-api) instance (its writes need a MongoDB **replica set** —
  Atlas or a `--replSet` mongod)

## Environment variables

Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

| Variable            | Description                                              | Default                 |
| ------------------- | ------------------------------------------------------- | ----------------------- |
| `VITE_SERVICE_HOST` | Base URL of the core-api backend (origin only)          | `http://localhost:4001` |
| `VITE_BUILD_ID`     | Build identifier (any string)                           | `dev`                   |

> `VITE_SERVICE_HOST` must match the port core-api actually listens on (its `PORT`), and that
> origin must equal core-api's `WEB_ORIGIN`'s counterpart — i.e. core-api's `WEB_ORIGIN` must be
> this app's origin (`http://localhost:5175` by default).

## Setup

Install workspace dependencies from the **repo root**:

```sh
yarn install
```

## Regenerating the API client

`src/client/Api.ts` is generated (and git-ignored). Whenever core-api's routes or DTOs change,
regenerate it from core-api:

```sh
# from examples/core-api
yarn generate-spec      # writes docs/api-json.json (no database required)
yarn generate-client    # writes ../core-web/src/client/Api.ts
```

## Development

```sh
yarn dev
```

The app runs at `http://localhost:5175`. Sign up with any email/password (core-api's
`LogEmailSender` just logs verification mail when `RESEND_API_KEY` is unset), then create and edit
notes.

## Building for production

```sh
yarn build      # vite-ssg static build into dist/
yarn preview    # preview the production build
```

## Project structure

```
src/
├── client/             # Auto-generated API client (Api.ts, git-ignored)
├── lib/
│   ├── auth.ts         # better-auth Vue client (createAuthClient)
│   ├── api.ts          # type-safe API client wrapper (credentials: 'include')
│   └── guard.ts        # session-aware vue-router navigation guard
├── router.ts           # routes + the authenticated guard
├── styles/             # shared dark theme (SCSS)
├── views/
│   ├── authenticated/
│   │   ├── Layout.vue      # header + nav + sign-out (useSession)
│   │   ├── Dashboard.vue   # status / greeting / session demo
│   │   └── Notes.vue       # revisable CRUD + revision history
│   ├── Login.vue       # email/password sign-in + sign-up
│   └── NotFound.vue    # 404
└── main.ts             # ViteSSG entry
```

## Endpoints used

| Call                                        | Endpoint                       | Auth          |
| ------------------------------------------- | ------------------------------ | ------------- |
| `authClient.signIn.email` / `signUp.email`  | `POST /api/auth/sign-in|up/email` | better-auth |
| `authClient.useSession` / `getSession`      | `GET /api/auth/get-session`    | better-auth   |
| `api.status.statusControllerStatus`         | `GET /status`                  | public        |
| `api.public.publicControllerGreeting`       | `GET /public/greeting`         | optional      |
| `api.me.meControllerMe`                     | `GET /me`                      | session       |
| `api.notes.notesControllerList`             | `GET /notes`                   | session       |
| `api.notes.notesControllerCreate`           | `POST /notes`                  | session       |
| `api.notes.notesControllerUpdate`           | `PUT /notes/{id}`              | session (409 on stale) |
| `api.notes.notesControllerRemove`           | `DELETE /notes/{id}?version=`  | session (409 on stale) |
| `api.notes.notesControllerRevisionHistory`  | `GET /notes/{id}/revisions`    | session       |
