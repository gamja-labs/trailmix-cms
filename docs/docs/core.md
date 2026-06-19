# Core

`@trailmix-cms/core` is the **recommended foundation** for Trailmix apps. Its **main entry is
provider-agnostic** — it gives you the shared **MongoDB connection** (via `@trailmix-cms/db`), the
`SecurityAuditCollection`, the `@AuditContext()` / `@RequireAdmin()` decorators, and OpenAPI build
helpers, and depends on no auth or email library.

```bash
yarn add @trailmix-cms/core @trailmix-cms/db @trailmix-cms/models @trailmix-cms/utils
```

Authentication and email are **optional**, behind subpath exports whose libraries are optional peer
dependencies — install only what you use:

| Subpath | Adds | Install (optional peers) |
| --- | --- | --- |
| [`@trailmix-cms/core/better-auth`](./better-auth.md) | Auth via [better-auth](https://www.better-auth.com) (orgs, admin, OpenAPI) | `better-auth @thallesp/nestjs-better-auth` |
| [`@trailmix-cms/core/clerk`](./clerk.md) | Auth via [Clerk](https://clerk.com) (account records, cms-compatible) | `@clerk/fastify` |
| [`@trailmix-cms/core/email`](./email.md) | Transactional email (Resend + react-email) | `resend @react-email/components @react-email/render react react-dom` |

Each layer stays replaceable at the API level: bring your own `createAuth` to swap better-auth, your
own `EmailSender` to swap Resend / the templates, or pick the Clerk provider instead — without forking
core.

::: tip ESM only
`@trailmix-cms/core` ships as ESM (`"type": "module"`) — your application must be ESM as well.
:::

## What's included

- **`setupTrailmixCore(options?)`** — returns spreadable `{ imports, providers, controllers,
  connectionModule }`. It opens the single shared Mongo connection inside Nest's DI (via
  `@trailmix-cms/db`'s `connectionFactory`), registers the `@trailmix-cms/db` providers and the
  security-audit collection/service, and exposes `connectionModule` so auth builds on the **same**
  connection.
- **Auth providers** (optional subpaths) — `setupTrailmixAuth(...)` / `createTrailmixAuth(...)` for
  [better-auth](./better-auth.md), or `setupTrailmixClerkAuth(...)` for [Clerk](./clerk.md). Both wire
  onto the same connection and enforce `@RequireAdmin()`.
- **`EmailSender` / `ResendEmailSender` / templates** — transactional email (optional subpath). See [Email](./email.md).
- **`@AuditContext()`** — a parameter decorator that injects an `AuditContext` for the authenticated
  user, ready to hand to audited `@trailmix-cms/db` collections.
- **`@RequireAdmin()`** — a marker decorator restricting a route/controller to admins; enforced by the
  guard `setupTrailmixAuth` registers.
- **Security audits** — `SecurityAuditCollection` + `SecurityAuditService`, and an optional read-only
  `security-audits` controller.
- **OpenAPI helpers** — `buildOpenApiDocument()` / `writeOpenApiSpec()`.

## Module setup

`setupTrailmixCore` opens **one** Mongo connection inside Nest's DI container — via
`@trailmix-cms/db`'s `connectionFactory`, which reads `MONGODB_CONNECTION_STRING` /
`MONGODB_DATABASE_NAME` / `GENERATE_SPEC` from `ConfigService` — and returns the
`imports` / `providers` / `controllers` you spread into your own `@Module({})`, plus a
`connectionModule` you hand to `setupTrailmixAuth` so authentication runs on that same pool.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { setupTrailmixCore } from '@trailmix-cms/core';
import { setupTrailmixAuth, createTrailmixAuth, configuration as authConfiguration } from '@trailmix-cms/core/better-auth';
import { ResendEmailSender } from '@trailmix-cms/core/email';

const cfg = authConfiguration();
const emailSender = new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY!, from: 'Acme <no-reply@acme.com>' });

// Core: opens the shared connection + security audits.
const core = setupTrailmixCore({ securityAuditsController: true });

// Auth: better-auth on the SAME connection, with the built-in email templates wired in.
const auth = setupTrailmixAuth({
    connectionModule: core.connectionModule,
    createAuth: (database) => createTrailmixAuth(database, {
        baseURL: cfg.BETTER_AUTH_URL,
        secret: cfg.BETTER_AUTH_SECRET,
        emailSender,
        organization: true,
        admin: true,
        openAPI: true,
    }),
});

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, authConfiguration] }),
        ...core.imports,
        ...auth.imports,
    ],
    controllers: [...core.controllers],
    providers: [...core.providers],
})
export class AppModule {}
```

See [Authentication](./better-auth.md) for `setupTrailmixAuth` / `createTrailmixAuth` and
[Email](./email.md) for the sender and templates.

### The connection

Core doesn't take connection params directly — it opens the connection through `@trailmix-cms/db`'s
`connectionFactory`, which reads them from `ConfigService`. Load that package's `configuration` into a
**global** `ConfigModule` (as above) so `MONGODB_CONNECTION_STRING` / `MONGODB_DATABASE_NAME` /
`GENERATE_SPEC` are validated and resolvable; if your `ConfigModule` isn't global, pass it to
`setupTrailmixCore`'s `imports` instead. Setting `GENERATE_SPEC=true` uses an inert connection stub
(for OpenAPI spec-generation runs that shouldn't touch Mongo).

The `connectionModule` returned by `setupTrailmixCore` owns and exports the `DB_CONNECTION` token.
Constructing `core` once and passing `core.connectionModule` to `setupTrailmixAuth` is what keeps the
connection single — the db providers and the better-auth instance both consume the same pool.

### Sharing the providers with feature modules

Spreading `core.providers` into a module makes `DatabaseService`, the revision/audit collections, and
the security-audit service injectable **within that module**. If a separate feature module of yours
needs them, add `trailmixCoreExports` to that module's `exports` so imported modules can inject them
too.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `securityAuditsController` | `true` | Register the `@RequireAdmin()`-marked `security-audits` controller. |
| `imports` | `[]` | Modules to make available to the connection factory — e.g. a non-global `ConfigModule`. |

## The AuditContext decorator

`@AuditContext()` builds an `AuditContext` for the currently authenticated user and injects it into a
controller method. Hand it straight to an audited `@trailmix-cms/db` collection so writes are
attributed to the user. The route must be protected by the global better-auth `AuthGuard`
`setupTrailmixAuth` registers so a session is present on the request.

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuditContext } from '@trailmix-cms/core';
import { AuditContext as AuditContextModel } from '@trailmix-cms/models';

@Controller('things')
export class ThingsController {
    @Post()
    create(@Body() body: CreateThingDto, @AuditContext() auditContext: AuditContextModel.Model) {
        return this.things.insertOne(body, auditContext);
    }
}
```

### The Trailmix principal is the `user._id`

The `principal_id` on every `AuditContext` (and every `SecurityAudit`) is **always the authenticating
user's `_id`** — i.e. `user._id`. It is **not** the `account` document's `_id`, and **not** the
provider-side `accountId`.

This matters because a single user can own many `account` records — one per login method (email/
password is one `account`, a linked Google login is another). Ownership, attribution and audit must
key to the stable *user* identity, not to whichever credential happened to be used, so that relinking
or removing a login method never orphans a user's records. `principal_type` (`account` vs `api_key`)
only distinguishes the *kind* of user identity; it does not change the fact that `principal_id` is the
`user._id`.

better-auth's MongoDB adapter exposes `user.id` as the hex string of that underlying `user._id`, so
`@AuditContext()` maps it directly onto an `ObjectId` for `principal_id` (with
`principal_type: account`).

For non-request (system/background) work, build a context without a request:

```typescript
import { systemAuditContext, createAuditContextForUser } from '@trailmix-cms/core';

await things.insertOne(body, systemAuditContext());          // { system: true }
await things.insertOne(body, createAuditContextForUser({ id })); // attributed to a known user
```

## Security audits

The `SecurityAuditCollection` (and a convenience `SecurityAuditService`) records security events such
as unauthorized access attempts:

```typescript
import { SecurityAuditService } from '@trailmix-cms/core';
import { SecurityAuditEventType, Principal } from '@trailmix-cms/models';

@Injectable()
export class MyService {
    constructor(private readonly securityAudits: SecurityAuditService) {}

    async flag(principalId: ObjectId) {
        await this.securityAudits.record({
            event_type: SecurityAuditEventType.UnauthorizedAccess,
            principal_id: principalId,
            principal_type: Principal.Account,
            message: 'Attempted to access a restricted resource',
        });
    }
}
```

When `securityAuditsController` is enabled (the default), a read-only `security-audits` endpoint is
registered, marked `@RequireAdmin()`. The guard `setupTrailmixAuth` registers enforces it against the
better-auth **admin** plugin's role.

## OpenAPI helpers

Core provides the document helpers:

```typescript
import { buildOpenApiDocument, writeOpenApiSpec } from '@trailmix-cms/core';

const document = buildOpenApiDocument(app, {
    title: 'My API',
    version: '1.0.0',
    // apiKey: { name: 'x-api-key' },                   // optional security scheme
});

SwaggerModule.setup('docs', app, document);             // serve the UI
// writeOpenApiSpec(document, { outputDir: './docs' }); // ...or write it to disk in CI
```

To fold better-auth's own endpoints into that document, use `TrailmixOpenApi` /
`mergeBetterAuthOpenAPISchema` — see [Authentication → OpenAPI](./better-auth.md#openapi-integration).

## Next Steps

- Set up [Authentication](./better-auth.md) (better-auth) or [Clerk](./clerk.md)
- Wire transactional [Email](./email.md)
- Learn about [Database Models](./database-models.md) and [Collections](./database-collections.md)
