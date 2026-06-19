# @trailmix-cms/core

better-auth integration for Trailmix, built on
[`@thallesp/nestjs-better-auth`](https://github.com/ThallesP/nestjs-better-auth) and
[`better-auth`](https://www.better-auth.com).

## What's included

- **`setupTrailmixCore({ createAuth })`** – the one entry point. It opens the single shared Mongo
  connection inside Nest's DI, builds the MongoDB adapter from it, and hands that adapter to your
  `createAuth` to build the better-auth instance. Returns spreadable
  `{ imports, providers, controllers }` that register `AuthModule` (better-auth route handler +
  global `AuthGuard`), the `@trailmix-cms/db` providers, and the security-audit collection/service.
- **Config helpers** – `createTrailmixAuth(database, config)` builds the better-auth **instance**
  (Trailmix plugins + defaults) from the adapter Trailmix hands you; `createTrailmixAuthConfig(...)`
  returns just the config object; `trailmixPlugins(...)` is the lower-level plugin builder. Use
  whichever level of control you want inside `createAuth`.
- **OpenAPI helpers** – `TrailmixOpenApi.buildDocument(app, ...)` builds a `@nestjs/swagger`
  document and folds better-auth's endpoints into it, resolving the auth instance from the app
  container. Lower-level `buildOpenApiDocument(...)` / `mergeBetterAuthOpenAPISchema(...)` /
  `writeOpenApiSpec(...)` are available too.
- **`SecurityAuditCollection` / `SecurityAuditService`** – the only collection carried over from
  the CMS, for recording and querying security events.
- **`@AuditContext()`** – a parameter decorator that injects an `AuditContext` for the
  authenticated better-auth user, ready to hand to audited `@trailmix-cms/db` collections.
- Re-exports of the better-auth NestJS decorators (`@Session`, `@Roles`, `@OrgRoles`,
  `@AllowAnonymous`, …) so you can import everything from one place.

> **ESM only.** This package targets the current (2.x) `@thallesp/nestjs-better-auth` line,
> which is ESM-only, so `@trailmix-cms/core` ships as ESM (`"type": "module"`). Consumers must
> be ESM as well.

## Usage

### 1. Set up the module

`setupTrailmixCore` opens **one** Mongo connection inside Nest's DI container — via
`@trailmix-cms/db`'s `connectionFactory`, which reads `MONGODB_CONNECTION_STRING` /
`MONGODB_DATABASE_NAME` / `GENERATE_SPEC` from `ConfigService` — shares it with `@trailmix-cms/db`
(single pool, cross-collection transactions), builds the MongoDB adapter, and hands that adapter
to your required `createAuth`. Drop it straight into `betterAuth({ database })` with
`trailmixPlugins` for the plugins, then spread the returned `imports` / `providers` /
`controllers` into your module. Load `@trailmix-cms/db`'s `configuration` into a global
`ConfigModule` so those vars are validated and resolvable:

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { setupTrailmixCore, trailmixPlugins, configuration as coreConfiguration } from '@trailmix-cms/core';

const cfg = coreConfiguration();
const core = setupTrailmixCore({
  createAuth: (database) => betterAuth({
    baseURL: cfg.BETTER_AUTH_URL,
    secret: cfg.BETTER_AUTH_SECRET,
    database,                              // the Mongo adapter Trailmix built, already pooled
    emailAndPassword: { enabled: true },
    plugins: [
      ...trailmixPlugins({ organization: true, admin: true, openAPI: true }),
      // ...add your own better-auth plugins here.
    ],
  }),
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, coreConfiguration] }),
    ...core.imports,
  ],
  controllers: [...core.controllers],
  providers: [...core.providers],
})
export class AppModule {}
```

#### Shorthand

`createTrailmixAuth(database, config)` is shorthand for
`betterAuth(createTrailmixAuthConfig({ ...config, database }))` — the Trailmix plugins and defaults
without spelling them out:

```ts
import { createTrailmixAuth } from '@trailmix-cms/core';

setupTrailmixCore({
  createAuth: (database) => createTrailmixAuth(database, {
    baseURL: cfg.BETTER_AUTH_URL,
    secret: cfg.BETTER_AUTH_SECRET,
    organization: true,
    admin: true,
    openAPI: true,
  }),
});
```

Bootstrap with the Fastify adapter (better-auth Fastify support is in beta):

```ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
```

### 2. Get the AuditContext in a controller

The route must be protected by the better-auth `AuthGuard` (registered globally by the
`AuthModule` the core setup imports) so a session is present on the request.

```ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuditContext } from '@trailmix-cms/core';
import { AuditContext as AuditContextModel } from '@trailmix-cms/models';

@Controller('things')
export class ThingsController {
  @Post()
  create(@Body() body: CreateThingDto, @AuditContext() auditContext: AuditContextModel.Model) {
    // hand the audit context straight to an audited @trailmix-cms/db collection
    return this.things.insertOne(body, auditContext);
  }
}
```

For non-request (system/background) work, use `systemAuditContext()` or
`createAuditContextForUser({ id })`.

## OpenAPI integration

better-auth ships an [OpenAPI plugin](https://www.better-auth.com/docs/plugins/open-api) that
documents all auth endpoints. Enable it with `openAPI: true` (in your `createAuth`), and you get a
standalone Scalar reference UI served by better-auth at **`/api/auth/reference`**.

### Merge auth endpoints into your NestJS Swagger docs

To show auth endpoints alongside the rest of your API in a single `@nestjs/swagger` document, use
`TrailmixOpenApi.buildDocument(app, ...)`. It builds the base document and folds in better-auth's
endpoints in one call, resolving the better-auth instance from the app container (no need to hold a
module-level `auth` reference):

```ts
// main.ts
import { SwaggerModule } from '@nestjs/swagger';
import { TrailmixOpenApi, writeOpenApiSpec } from '@trailmix-cms/core';

const document = await TrailmixOpenApi.buildDocument(app, {
  title: 'My API',
  version: '1.0.0',
  // apiKey: { name: 'x-api-key' },                       // optional security scheme
  // configure: (builder) => builder.addServer('https://api.example.com'),
});

// Serve the UI...
SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/json' });

// ...or, in a CI "generate spec then exit" flow, write it to disk:
// writeOpenApiSpec(document, { outputDir: './docs' });
```

Under the hood that's `buildOpenApiDocument(...)` + `mergeBetterAuthOpenAPISchema(document, auth)`;
call those directly if you already have the `auth` instance in hand (e.g. `app.get(AuthService)`).
better-auth emits paths relative to its root (e.g. `/sign-in/email`); they're prefixed with
`basePath` (default `/api/auth`) and tagged `auth`.

If you'd rather keep the two specs separate, point a multi-source viewer (e.g. Scalar) at both
your app's spec and `/api/auth/reference` instead of merging.
