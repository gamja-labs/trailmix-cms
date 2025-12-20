# Installation

This guide will help you install and set up Trailmix CMS in your NestJS project.

## Prerequisites

- Node.js (v24 or higher)
- NestJS application
- [Clerk](https://clerk.com/) api keys 
- MongoDB instance. [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) has a Free tier.

## Installing Packages

Trailmix CMS is published as scoped packages under `@trailmix-cms`. Install the packages you need:

```bash
yarn add @trailmix-cms/cms @trailmix-cms/db @trailmix-cms/models @trailmix-cms/utils
```
## Peer Dependencies

Make sure you have the required peer dependencies installed:

```bash
yarn add @nestjs/common @nestjs/core fastify mongodb nestjs-zod reflect-metadata rxjs zod
```

### Vue Package (for frontend)

```bash
yarn add @trailmix-cms/vue
```

## Next Steps

After installation, proceed to the [Configuration](./configuration.md) guide to configure Trailmix CMS for your project.






