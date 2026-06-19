<div align="center">
<a href="https://docs.trailmixcms.com"><img src="docs/docs/.vuepress/public/images/emblem.svg" width="200" alt="Trailmix CMS" /></a>

# Trailmix CMS

**Type-safe content management system for NestJS**

[![Documentation](https://img.shields.io/badge/docs-trailmixcms.com-blue)](https://docs.trailmixcms.com)
[![License](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)

</div>

Trailmix CMS is an opinionated type-safe content management system built for NestJS applications. It provides a comprehensive set of tools for managing database models, collections, and content with full TypeScript support.

## Dependencies

Trailmix builds on a few key technologies:

- **MongoDB**: Database storage and collection management
- **Fastify**: Web framework
- **nestjs-zod** / **Zod**: Schema validation and OpenAPI generation
- An **authentication provider** of your choice — better-auth or Clerk

## Key Features

- **Type Safety**: Full TypeScript support with Zod schema validation
- **OpenAPI Spec with Zod**: Automatic OpenAPI/Swagger documentation generation from Zod schemas via nestjs-zod integration 
- **Audit Trail**: Built-in support for audited collections
- **Modular Architecture**: Use only what you need — the database, auth providers, and email are independent packages and subpaths.

# Getting started

See the [Docs](https://docs.trailmixcms.com)

# License

TrailmixCMS is [MIT licensed](./License)