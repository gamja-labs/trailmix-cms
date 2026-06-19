# Authentication (better-auth)

The authentication layer of [`@trailmix-cms/core`](./core.md) delegates auth, organizations, and
admin/RBAC to [better-auth](https://www.better-auth.com) via
[`@thallesp/nestjs-better-auth`](https://github.com/ThallesP/nestjs-better-auth), building on the
shared Mongo connection `setupTrailmixCore` opens. Users, sessions, organizations, and admin roles are
owned by better-auth (the only collection core carries is the `SecurityAuditCollection`).

Swap it for a different provider by supplying your own `createAuth` — the rest of core doesn't care
how the session lands on the request.

## What's included

- **`setupTrailmixAuth({ connectionModule, createAuth })`** — returns `{ imports }` that register
  `AuthModule` (the better-auth route handler + a global `AuthGuard`) on core's shared connection,
  plus a guard that enforces `@RequireAdmin()` against the admin plugin's role.
- **`createTrailmixAuthConfig()` / `createTrailmixAuth()`** — build a ready-to-use better-auth
  config/instance (MongoDB adapter + optional **organization**, **admin**, **OpenAPI** plugins, and
  the built-in **email** templates), or use `trailmixPlugins` as building blocks in your own
  `betterAuth(...)` call.
- **OpenAPI** — `mergeBetterAuthOpenAPISchema()` / `TrailmixOpenApi` fold better-auth's endpoints
  into your `@nestjs/swagger` document.
- **Re-exports** of the better-auth NestJS decorators (`@Session`, `@Roles`, `@OrgRoles`,
  `@AllowAnonymous`, `@OptionalAuth`, `@Hook`, `@DatabaseHook`, …).

Everything here lives at the `@trailmix-cms/core/better-auth` subpath. better-auth is **optional** —
its libraries are optional peers, so install them when you choose this provider:

```bash
yarn add better-auth @thallesp/nestjs-better-auth
```

## Module setup

`setupTrailmixAuth` takes the `connectionModule` from `setupTrailmixCore` (so better-auth builds its
adapter on the same pool) and a `createAuth(database)` that returns the better-auth instance. Trailmix
creates the MongoDB adapter from the shared connection and passes it in as `database` — drop it into
`betterAuth({ database })` with `trailmixPlugins`, or use the `createTrailmixAuth` shorthand:

```typescript
import { setupTrailmixCore } from '@trailmix-cms/core';
import { setupTrailmixAuth, createTrailmixAuth, configuration as authConfiguration } from '@trailmix-cms/core/better-auth';

const cfg = authConfiguration();
const core = setupTrailmixCore();
const auth = setupTrailmixAuth({
    connectionModule: core.connectionModule,
    createAuth: (database) => createTrailmixAuth(database, {
        baseURL: cfg.BETTER_AUTH_URL,
        secret: cfg.BETTER_AUTH_SECRET,
        organization: true,
        admin: true,
        openAPI: true,
    }),
});

// imports: [...core.imports, ...auth.imports]
```

### Using `betterAuth` directly

`createTrailmixAuth(database, config)` is shorthand for
`betterAuth(createTrailmixAuthConfig({ ...config, database }))`. To compose better-auth yourself, use
`trailmixPlugins` for the Trailmix-managed plugins:

```typescript
import { betterAuth } from 'better-auth';
import { trailmixPlugins } from '@trailmix-cms/core/better-auth';

setupTrailmixAuth({
    connectionModule: core.connectionModule,
    createAuth: (database) => betterAuth({
        baseURL: cfg.BETTER_AUTH_URL,
        secret: cfg.BETTER_AUTH_SECRET,
        database,
        emailAndPassword: { enabled: true },
        plugins: [...trailmixPlugins({ organization: true, admin: true, openAPI: true })],
    }),
});
```

### Plugins

The `organization`, `admin`, and `openAPI` options accept either `true` (defaults) or a plugin
options object:

```typescript
trailmixPlugins({
    organization: { allowUserToCreateOrganization: false },
    admin: { defaultRole: 'user' },
    openAPI: { path: '/reference' },
});
```

### Options

| Option (`createTrailmixAuth`) | Description |
| --- | --- |
| `secret` / `baseURL` | better-auth secret + base URL (see [config](#configuration)). |
| `organization` / `admin` / `openAPI` | `true` or a plugin options object. |
| `emailSender` | An [`EmailSender`](./email.md) — wires the verification / reset / invitation emails. |
| `email` | Branding, per-template overrides, and invitation-URL tweaks for the built-in templates. |
| `plugins` | Extra better-auth plugins to register alongside the Trailmix ones. |
| _any `BetterAuthOptions`_ | Forwarded to better-auth (`hooks`, `databaseHooks`, `emailAndPassword`, …). |

## Email integration

Pass an `emailSender` (any [`EmailSender`](./email.md), e.g. `ResendEmailSender`) and the built-in
react-email templates are wired into better-auth automatically — **unless** you've supplied those
callbacks yourself:

- `emailAndPassword.sendResetPassword` → password-reset template
- `emailVerification.sendVerificationEmail` → email-verification template
- the organization plugin's `sendInvitationEmail` → invitation template

```typescript
import { ResendEmailSender } from '@trailmix-cms/core/email';

const emailSender = new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY!, from: 'Acme <no-reply@acme.com>' });

createTrailmixAuth(database, {
    secret: cfg.BETTER_AUTH_SECRET,
    baseURL: cfg.BETTER_AUTH_URL,
    emailSender,
    email: {
        branding: { productName: 'Acme', accentColor: '#7c3aed' },
        // organizationInvitationUrl: ({ id }) => `https://acme.com/invite/${id}`,
    },
    organization: true,
    admin: true,
});
```

Bring your own mailer by passing any object that satisfies `EmailSender`. Replace individual
templates with `email.templates` (keeps the wiring), or set the better-auth callback yourself to
bypass it entirely — see [Email → Replacing a template](./email.md#replacing-a-template).

## Configuration

`@trailmix-cms/core` exports a `configuration` that validates the env it owns. Load it into a
global `ConfigModule` alongside `@trailmix-cms/db`'s `configuration`:

| Variable | Default | Description |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | _required_ | Secret used to sign cookies/tokens. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Base URL better-auth is served from. |

During `GENERATE_SPEC=true` runs the secret may be empty (no real auth happens).

## Bootstrap

better-auth's Fastify support is in beta — bootstrap with the Fastify adapter:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
await app.listen({ port: 3000, host: '0.0.0.0' });
```

## OpenAPI integration

Enabling the OpenAPI plugin (`openAPI: true`) gives you better-auth's standalone Scalar reference UI
at **`/api/auth/reference`**. To show auth endpoints alongside the rest of your API in a single
`@nestjs/swagger` document, use `TrailmixOpenApi` (it builds the base document via core, then folds in
better-auth, resolving the auth instance from the app):

```typescript
// main.ts
import { SwaggerModule } from '@nestjs/swagger';
import { writeOpenApiSpec } from '@trailmix-cms/core';
import { TrailmixOpenApi } from '@trailmix-cms/core/better-auth';

const document = await TrailmixOpenApi.buildDocument(app, { title: 'My API', version: '1.0.0' });

SwaggerModule.setup('docs', app, document);              // serve the UI
// writeOpenApiSpec(document, { outputDir: './docs' });  // ...or write it to disk in CI
```

Prefer to keep the specs separate? Point a multi-source viewer (e.g. Scalar) at both your app's spec
and `/api/auth/reference` instead of merging, or call `mergeBetterAuthOpenAPISchema(document, auth)`
yourself.

## Next Steps

- Configure transactional [Email](./email.md)
- Review the auth-agnostic [Core](./core.md) foundation
