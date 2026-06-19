# Introduction

**What is Trailmix CMS?**

Trailmix CMS is an opinionated type-safe content management system built for NestJS applications. It provides a comprehensive set of tools for managing database models, collections, and content with full TypeScript support.

## Start with `@trailmix-cms/core`

**[`@trailmix-cms/core`](./core.md) is the recommended foundation** — a modular, provider-agnostic base
(the shared MongoDB connection, audited collections, security audits, and OpenAPI helpers). You add
only what you need, as optional subpaths:

- **Authentication** — [better-auth](./better-auth.md) (self-hosted) or [Clerk](./clerk.md)
- **Transactional email** — [Resend + react-email](./email.md)

Each layer installs and is replaceable independently, all on [`@trailmix-cms/db`](./database-models.md).

## Dependencies

Trailmix builds on a few key technologies:

- **MongoDB**: Database storage and collection management
- **Fastify**: Web framework
- **nestjs-zod** / **Zod**: Schema validation and OpenAPI generation
- An **authentication provider** of your choice — [better-auth](./better-auth.md) or [Clerk](https://clerk.com)

## Key Features

- **Type Safety**: Full TypeScript support with Zod schema validation
- **OpenAPI Spec with Zod**: Automatic OpenAPI/Swagger documentation generation from Zod schemas via nestjs-zod integration 
- **Audit/Revision Trail**: Built-in support for audit and revision tracking

## Next Steps

Ready to start building? Check out the [Installation](./installation.md) guide to get Trailmix CMS set up in your project.



