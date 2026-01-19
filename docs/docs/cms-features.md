# Auth Guard Hook

The **auth guard hook** is a powerful feature that allows you to execute custom logic when an account is **first created** in the database during authentication.

## How It Works

- When a user authenticates via Clerk, the CMS checks if an account exists in the database
- If the account **doesn't exist**, it's automatically created
- **Only after creating a new account**, the `onHook` method is called on the auth guard hook instance with the account entity
- The hook can perform any async operations (database queries, API calls, notifications, etc.)
- The hook must return `true` to allow authentication to proceed, or `false` to reject the request

**Important**: The hook runs **only once** per user - when their account is first created. It does not run on subsequent authentications for existing accounts.

## Use Cases

Since the hook only runs once when an account is first created, it's perfect for:

- **Initialize default data** for new users (create default todo lists, settings, etc.)
- **Send welcome emails** or notifications to new users
- **Set up user-specific configurations** and initial preferences
- **Sync initial user data** from external systems
- **Validate new account creation** and potentially reject it by returning `false`

## Example

Create a hook class that implements the `AuthGuardHook` interface:

```typescript
// Imports...
import { AuthGuardHook } from '@trailmix-cms/cms';

@Injectable()
export class AppAuthGuardHook implements AuthGuardHook {

    // Inject dependencies...

    async onHook(account: models.Account.Entity): Promise<boolean> {
        // This hook only runs when the account is first created
        // It will NOT run on subsequent authentications for this user
        
        // Create default todo list for new users
        await todoListCollection.insertOne({
            name: 'My Todos',
        }, {
            system: false,
            anonymous: false,
            account_id: account._id,
        });
        
        // Send welcome email to new user
        await emailService.sendWelcomeEmail(account.user_id);
        
        // Validate account status (optional)
        // Return false to reject account creation
        if (account.suspended) {
            return false; // Reject authentication
        }
        
        return true; // Allow authentication to proceed
    }
}
```

Then configure it in your module's providers array using the `provideAuthGuardHook` helper:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, provideAuthGuardHook, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';
import { AppAuthGuardHook } from './hooks/auth-guard.hook';

const trailmixCMS = setupTrailmixCMS({
    // ... other config
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
        provideAuthGuardHook(AppAuthGuardHook),
        // ... other providers
    ],
})
export class AppModule {}
```

## Important Notes

- The hook runs **synchronously** during the authentication flow
- Keep operations fast to avoid delaying user login
- For heavy operations, consider queuing them for background processing
- Returning `false` will reject the authentication request with a 500 error
- The hook receives the account entity that was just created

## Configuration

The auth guard hook is configured using the `provideAuthGuardHook` helper function in your module's `providers` array. You must provide a class that implements the `AuthGuardHook` interface:

```typescript
import { provideAuthGuardHook } from '@trailmix-cms/cms';

@Module({
    providers: [
        provideAuthGuardHook(AppAuthGuardHook),
        // ... other providers
    ],
})
export class AppModule {}
```

If no hook is provided, the default behavior is to always return `true`, allowing authentication to proceed.

---

# Organizations Feature

The **organizations feature** enables multi-tenant support, allowing you to group accounts into organizations with organization-specific roles and permissions.

## Overview

When enabled, the organizations feature provides:

- **Organization Management** - Create, update, and delete organizations
- **Organization Roles** - Assign roles to accounts within organizations
- **Organization Scoping** - Scope resources and permissions to specific organizations
- **Authorization Service** - Check permissions within organization context

## Enabling Organizations

Enable organizations by setting `enableOrganizations: true` in your feature configuration:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { setupTrailmixCMS, FeatureConfig, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';

const features: FeatureConfig = {
    enableOrganizations: true,
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

## Custom Organization Setup

You can provide custom setup logic for the organization collection (e.g., custom indexes):

```typescript
import { setupTrailmixCMS, FeatureConfig } from '@trailmix-cms/cms';
import type { Collection } from 'mongodb';
import { Organization } from '@trailmix-cms/models';

const features: FeatureConfig = {
    enableOrganizations: true,
};

const trailmixCMS = setupTrailmixCMS({
    features,
    entities: {
        // Optional: Custom setup for organization collection
        organizationSetup: async (collection: Collection<Organization.Entity>) => {
            await collection.createIndex({ name: 1 }, { unique: true });
            await collection.createIndex({ slug: 1 }, { unique: true, sparse: true });
        },
    },
});
```

**Note**: The `organizationSetup` function is optional. If not provided, no custom setup will run.

## Organization Delete Hook

You can provide a hook that runs when an organization is deleted:

```typescript
import { Injectable } from '@nestjs/common';
import { OrganizationDeleteHook } from '@trailmix-cms/cms';
import { Organization } from '@trailmix-cms/models';

@Injectable()
export class AppOrganizationDeleteHook implements OrganizationDeleteHook {
    async onDelete(organization: Organization.Entity): Promise<void> {
        // Clean up organization-specific resources
        // This hook runs before the organization is deleted
    }
}
```

Configure it in your module:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { provideOrganizationDeleteHook, configuration as cmsConfiguration } from '@trailmix-cms/cms';
import { configuration as databaseConfiguration } from '@trailmix-cms/db';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfiguration, cmsConfiguration],
        }),
    ],
    providers: [
        provideOrganizationDeleteHook(AppOrganizationDeleteHook),
    ],
})
export class AppModule {}
```

---

# API Keys Feature

The **API keys feature** enables programmatic access to your API using API keys instead of user authentication.

## Overview

When enabled, the API keys feature provides:

- **API Key Management** - Create, list, and revoke API keys
- **Scope-Based Access** - Control what API keys can access
- **Secure Storage** - API keys are hashed before storage
- **Automatic Generation** - Unique API keys are automatically generated

## Enabling API Keys

Enable API keys by setting `apiKeys.enabled: true` in your feature configuration:

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

## API Key Scopes

API keys can be scoped to different contexts:

- **`ApiKeyScope.Account`** - Account-scoped API keys (limited to a specific account)
- **`ApiKeyScope.Organization`** - Organization-scoped API keys (limited to a specific organization)
- **`ApiKeyScope.Global`** - Global API keys (full access)

The `scopes` array in the configuration determines which scopes are allowed when creating API keys.

## What Gets Included

When API keys are enabled, the following are automatically added:

### Controllers
- `ApiKeysController` - CRUD operations for API keys

### Services
- `ApiKeyService` - API key business logic and validation

### Collections
- `ApiKeyCollection` - API key data access

## Using API Keys

API keys are passed in the request headers. The exact header name depends on your configuration, but typically:

```
X-API-Key: your-api-key-here
```

The API key is validated and the associated account/organization context is made available to your controllers.

## Security Considerations

- API keys are hashed before storage (never stored in plain text)
- Each API key is unique and automatically generated
- API keys can be revoked at any time
- Scope restrictions limit what each API key can access
- Consider implementing rate limiting for API key requests

## Next Steps

- Learn about [Database Models](./database-models.md)
- Set up [Database Collections](./database-collections.md)
- See [Configuration](./configuration.md) for other CMS setup options
