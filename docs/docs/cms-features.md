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
import { CmsModule, provideAuthGuardHook } from '@trailmix-cms/cms';
import { AppAuthGuardHook } from './hooks/auth-guard.hook';

@Module({
    imports: [
        CmsModule.forRoot({
            // ... other config
        }),
    ],
    providers: [
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

## Next Steps

- Learn about [Database Models](./database-models.md)
- Set up [Database Collections](./database-collections.md)
- See [Configuration](./configuration.md) for other CMS setup options
