# Configuration

## Examples

For the full recommended setup, see the example projects:

[https://github.com/gamja-labs/trailmix-cms/tree/main/examples](https://github.com/gamja-labs/trailmix-cms/tree/main/examples)


## Environment Variables

Set the following environment variables:

```bash
# MongoDB Configuration
MONGODB_CONNECTION_STRING=mongodb+srv://..  
# (Optional, database name defaults to "main")
MONGODB_DATABASE_NAME=your-db-name

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Application Configuration
NODE_ENV=development
PORT=3000
```

## Module Setup

Use `setupTrailmixCMS()` to configure and get providers and controllers for your NestJS application. You must also configure `ConfigModule` to load the database and CMS configurations for environment variable validation:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';

const trailmixCMS = setupTrailmixCMS();

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

**Important**: The `databaseConfiguration` and `cmsConfiguration` must be loaded in `ConfigModule.forRoot()` to validate required environment variables:
- `databaseConfiguration` validates `MONGODB_CONNECTION_STRING` and `MONGODB_DATABASE_NAME`
- `cmsConfiguration` validates `CLERK_SECRET_KEY`

These configurations use `envalid` to validate and type-check your environment variables at startup. If required variables are missing or invalid, your application will fail to start with a clear error message.

### Why Configuration is Required

The `databaseConfiguration` and `cmsConfiguration` functions validate that all required environment variables are present and correctly formatted before your application starts. This prevents runtime errors and provides clear feedback if configuration is missing.

**What gets validated:**
- **`databaseConfiguration`** (`@trailmix-cms/db`):
  - `MONGODB_CONNECTION_STRING` - Required MongoDB connection string
  - `MONGODB_DATABASE_NAME` - Optional, defaults to `"main"`

- **`cmsConfiguration`** (`@trailmix-cms/cms`):
  - `CLERK_SECRET_KEY` - Required Clerk secret key for authentication

If you have your own configuration function, you can include it alongside these:

```typescript
import { ConfigModule } from '@nestjs/config';
import { configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { configuration as appConfiguration } from './config';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [appConfiguration, databaseConfiguration, cmsConfiguration],
        }),
    ],
})
export class AppModule {}
```

## Advanced Configuration

### Extending the Base Account Entity Schema

The base `Account` schema from `@trailmix-cms/models` provides the foundation, which you can extend using Zod's `.extend()` method.

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { Account } from '@trailmix-cms/models';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const extendedAccountEntitySchema = Account.entitySchema.extend({
    name: z.string(),
});

const trailmixCMS = setupTrailmixCMS({
    entities: {
        accountSchema: extendedAccountEntitySchema,
    },
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

### Adding Custom Indexes

You can add custom indexes to collections by providing `accountSetup` and/or `organizationSetup` functions. These functions are **optional** - if not provided, no custom setup will run. When provided, the function receives the MongoDB collection instance and allows you to create indexes:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { Account } from '@trailmix-cms/models';
import type { Collection } from 'mongodb';

const trailmixCMS = setupTrailmixCMS({
    entities: {
        // Optional: Custom setup for account collection
        accountSetup: async (collection: Collection<Account.Entity>) => {
            // Create a sparse index on the 'name' field
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
    },
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

**Note**: The `accountSetup` and `organizationSetup` functions are optional. If you don't need custom indexes or setup logic, you can omit them entirely.

## Feature Configuration

### Organizations Feature

Enable multi-tenant organization support by setting `enableOrganizations: true`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, FeatureConfig, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import type { Collection } from 'mongodb';

const features: FeatureConfig = {
    enableOrganizations: true,
};

const trailmixCMS = setupTrailmixCMS({
    features,
    entities: {
        // Optional: Custom setup for organization collection
        organizationSetup: async (collection: Collection<any>) => {
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
    },
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

### API Keys Feature

Enable API key authentication by setting `apiKeys.enabled: true`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, FeatureConfig, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { ApiKeyScope } from '@trailmix-cms/models';

const features: FeatureConfig = {
    apiKeys: {
        enabled: true,
        scopes: [
            ApiKeyScope.Account,
            ApiKeyScope.Organization,
            ApiKeyScope.Global,
        ],
    },
};

const trailmixCMS = setupTrailmixCMS({
    features,
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

**API Key Scopes:**
- `ApiKeyScope.Account` - Account-scoped API keys
- `ApiKeyScope.Organization` - Organization-scoped API keys  
- `ApiKeyScope.Global` - Global API keys

When API keys are enabled, the following are automatically included:
- `ApiKeysController` - Manage API keys
- `ApiKeyService` - API key business logic
- `ApiKeyCollection` - API key data access

### Enabling Multiple Features

You can enable both organizations and API keys together:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, FeatureConfig, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { ApiKeyScope } from '@trailmix-cms/models';
import type { Collection } from 'mongodb';

const features: FeatureConfig = {
    enableOrganizations: true,
    apiKeys: {
        enabled: true,
        scopes: [
            ApiKeyScope.Account,
            ApiKeyScope.Organization,
            ApiKeyScope.Global,
        ],
    },
};

const trailmixCMS = setupTrailmixCMS({
    features,
    entities: {
        accountSetup: async (collection: Collection<any>) => {
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
        organizationSetup: async (collection: Collection<any>) => {
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
    },
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
    ],
})
export class AppModule {}
```

## Next Steps

- Learn about [Database Models](./database-models.md)
- Set up [Database Collections](./database-collections.md)
- Explore [CMS Features](./cms-features.md) for more advanced features



