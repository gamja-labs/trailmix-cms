# Installation

This guide will help you install and set up Trailmix CMS in your NestJS project.

## Prerequisites

- Node.js (v24 or higher)
- NestJS application (ESM — `"type": "module"` — for the core stack)
- MongoDB instance. [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) has a Free tier.
- An authentication provider:
  - **[better-auth](https://www.better-auth.com)** (self-hosted; just a `BETTER_AUTH_SECRET`), or
  - **[Clerk](https://clerk.com/)** API keys.
- Optionally a [Resend](https://resend.com) API key for transactional email.

## Installing packages

Install the provider-agnostic core plus its base peers:

```bash
yarn add @trailmix-cms/core @trailmix-cms/db @trailmix-cms/models @trailmix-cms/utils
yarn add @nestjs/common @nestjs/core @nestjs/config @nestjs/swagger \
  fastify mongodb nestjs-zod reflect-metadata rxjs zod
```

Then **pick an auth provider** (each is an optional subpath with optional peer deps):

```bash
# better-auth (self-hosted) — see ./better-auth.md
yarn add better-auth @thallesp/nestjs-better-auth

# …or Clerk — see ./clerk.md
yarn add @clerk/fastify
```

And optionally add **transactional email** (Resend + react-email) — see [Email](./email.md):

```bash
yarn add resend @react-email/components @react-email/render react react-dom
```

Then set `MONGODB_CONNECTION_STRING` and your provider's secret (`BETTER_AUTH_SECRET` from
`openssl rand -base64 32`, or `CLERK_SECRET_KEY`), plus `RESEND_API_KEY` / `EMAIL_FROM` for real email.
See [Core](./core.md), [better-auth](./better-auth.md), [Clerk](./clerk.md), and [Email](./email.md).

## Frontend (Vue)

For a Vue frontend (Clerk integration):

```bash
yarn add @trailmix-cms/vue
```

## Next Steps

See [Core](./core.md), then your auth provider ([better-auth](./better-auth.md) or [Clerk](./clerk.md)) and [Email](./email.md).
