# Authentication (Clerk)

The Clerk provider for [`@trailmix-cms/core`](./core.md), at the `@trailmix-cms/core/clerk` subpath,
authenticates requests with [Clerk](https://clerk.com) via `@clerk/fastify` and brings the full
**cms-compatible authorization model**: principals, global & organization roles, and API keys. Each
Clerk user is mapped to a local **account record** (an `Account` whose `_id` is a Mongo `ObjectId`)
used as the audit principal.

::: tip Migrating from `@trailmix-cms/cms`?
This provider is **wire-compatible** with `@trailmix-cms/cms` (Clerk): the same collections
(`account`, `role`, `organization`, `api-key`, `security-audit`), the same `@trailmix-cms/models`
schemas, and the same `@clerk/fastify` user → account mapping. An app switching cms → core reads its
existing data with **no migration**. (Not ported: cms's account/organization *schema extensibility*
and its account/audits controllers.)
:::

## Installation

Clerk is **optional** — install its peer when you choose this provider:

```bash
yarn add @clerk/fastify
```

Set `CLERK_SECRET_KEY` (validated by this provider's `configuration`):

```bash
CLERK_SECRET_KEY=sk_test_...
```

## Module setup

Spread `setupTrailmixClerkAuth()` alongside `setupTrailmixCore()`. The auth collections consume the
`@trailmix-cms/db` providers (and the security-audit collection) that core contributes, on the shared
connection — so spread core's `imports` **and** `providers`. Toggle organizations / API keys via
`features`:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { setupTrailmixCore } from '@trailmix-cms/core';
import { setupTrailmixClerkAuth, configuration as clerkConfiguration } from '@trailmix-cms/core/clerk';

// The security-audits controller is @RequireAdmin (a better-auth idiom) — disable it under Clerk.
const core = setupTrailmixCore({ securityAuditsController: false });
const auth = setupTrailmixClerkAuth({
    features: { enableOrganizations: true, apiKeys: { enabled: true, scopes: ['account', 'organization', 'global'] } },
    // Opt-in controllers (all off by default).
    controllers: { account: true, securityAudits: true },
});

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, clerkConfiguration] }),
        ...core.imports,
        ...auth.imports,
    ],
    controllers: [...auth.controllers],
    providers: [...core.providers, ...auth.providers],
})
export class AppModule {}
```

With `features` enabled you get the `organizations`, `organization-roles`, `global-roles`, and
`api-keys` controllers; `global-roles` is always registered.

## Bootstrap

Register the Clerk Fastify plugin on the app before listening — `getAuth` (used by the guard) needs it:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { clerkPlugin } from '@trailmix-cms/core/clerk';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await app.register(clerkPlugin, { secretKey: process.env.CLERK_SECRET_KEY });
await app.listen({ port: 3000, host: '0.0.0.0' });
```

## Protecting routes — `@Auth`

`@Auth({...})` attaches the `AuthGuard`, which resolves the {@link RequestPrincipal} (an API key or a
Clerk-mapped account), validates it against the options, and sets `request.principal`. Read it with
`@PrincipalContext()` and the audit context with `@AuditContext()` (both from `@trailmix-cms/core/clerk`).

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { Auth, PrincipalContext, AuditContext, type RequestPrincipal } from '@trailmix-cms/core/clerk';
import { Principal, RoleValue, AuditContext as AuditContextModel } from '@trailmix-cms/models';

@Controller('things')
export class ThingsController {
    // Any authenticated account (the default).
    @Auth()
    @Get()
    list(@PrincipalContext() principal: RequestPrincipal) { /* ... */ }

    // Accounts or API keys; global admins only.
    @Auth({ requiredPrincipalTypes: [Principal.Account, Principal.ApiKey], requiredGlobalRoles: [RoleValue.Admin] })
    @Post()
    create(@Body() body: CreateThingDto, @AuditContext() audit: AuditContextModel.Model) { /* ... */ }
}
```

`@Auth` options:

| Option | Default | Description |
| --- | --- | --- |
| `requiredPrincipalTypes` | `[Principal.Account]` | Which principal types may call the route (account / api_key). |
| `requiredGlobalRoles` | `[]` | Required global role(s); `RoleValue.Admin` is an absolute bypass. |
| `requiredApiKeyScopes` | `[]` | For API-key principals, which scopes may call the route. |
| `allowAnonymous` | `false` | Let unauthenticated requests through. |

Because `request.principal.entity._id` is the local account `ObjectId`, `@AuditContext()` and audited
`@trailmix-cms/db` collections attribute writes to the account.

> **Note — principal divergence from better-auth.** Under the Clerk integration, `principal_id` is the
> local **`account._id`**. Under core's better-auth integration, `principal_id` is the **`user._id`**
> (see [The Trailmix principal is the `user._id`](./core.md#the-trailmix-principal-is-the-user-id)).
> This is intentional: the Clerk principal model is built around `account`/`api_key` entities and does
> not surface a separate user document. If you run both integrations against one dataset, be aware that
> `principal_id` can reference either collection depending on which path wrote the record.

## Roles, organizations, API keys

Enabling `features` registers REST controllers (all `@Auth`-protected):

- **`global-roles`** — assign/list/remove global roles (admin only). Global `admin` grants access everywhere.
- **`organizations`** / **`organization-roles`** — read/update orgs and assign org-scoped roles (`owner`/`admin`/`user`/`reader`). Org admin/owner manage their org; global admin overrides.
- **`api-keys`** — create/list/delete API keys scoped to an account, organization, or globally. Authorization follows the scope (account → owner, organization → org admin/owner, global → global admin). Send keys via the `x-api-key` header.

Roles live in one `role` collection (discriminated by `type`); the `AuthorizationService` evaluates
global vs. org access (global admin is an absolute bypass). This is identical to `@trailmix-cms/cms`.

### Opt-in controllers

These extra controllers are **off by default** — mount them via `controllers: { … }`:

| Flag | Mounts | Routes |
| --- | --- | --- |
| `account` | `AccountController` | `GET /account`, `GET /account/global-roles` (current account) |
| `audit` | `AuditController` | `GET /audit/:type/:id` — entity audit history (admin) |
| `audits` | `AuditsController` | `GET /audits/:type/:id` — same, account or API-key principals |
| `securityAudits` | `SecurityAuditsController` | `GET /security-audits`, `GET /security-audits/:id` (admin) |

They reuse providers already registered (the db audit collection, core's security-audit collection,
`GlobalRoleService`), so enabling them adds no extra setup. Use `securityAudits` here instead of
core's `@RequireAdmin`-marked `SecurityAuditsController` (which is a better-auth idiom).

### Hooks

- `provideAuthGuardHook(MyHook)` — runs when an account is first created (return `false` to reject auth).
- `provideOrganizationDeleteHook(MyHook)` — runs inside the org cascade-delete transaction.

Add either to your module `providers`.

## Next Steps

- Review the agnostic [Core](./core.md) foundation
- Prefer self-hosted auth? See [better-auth](./better-auth.md) (its own org/admin/api-key plugins)
