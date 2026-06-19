# core-api

A minimal [NestJS](https://nestjs.com/) API that uses **only** [`@trailmix-cms/core`](../../packages/core) — no CMS features and no web frontend. It's the smallest useful starting point for a Trailmix backend:

- **better-auth** authentication (email/password, organization, admin, and OpenAPI plugins) wired up through `setupTrailmixCore`
- A globally-applied auth guard — every route is protected unless marked `@AllowAnonymous()`
- Sample endpoints demonstrating the `@thallesp/nestjs-better-auth` decorators & features (see below)
- A **revisable collection** (`notes`) built on `@trailmix-cms/db`'s `RevisableCollection` — versioned, optimistic-concurrency writes with full revision history
- The built-in admin-guarded **security-audits** endpoints from the core module
- An OpenAPI document (served at `/docs`) that includes the better-auth routes


## Setup

From the repository root, install workspace dependencies:

```bash
yarn install
```

Then, in this directory, create your environment file:

```bash
cp .env.example .env
# edit .env: set MONGODB_CONNECTION_STRING and a real BETTER_AUTH_SECRET
#   openssl rand -base64 32
```

## Run

```bash
yarn workspace core-api start:dev   # watch mode
# or, from this directory:
yarn start:dev
```

## Generate the OpenAPI spec

Writes `docs/api-json.json` and exits without needing a running database:

```bash
yarn generate-spec
```
