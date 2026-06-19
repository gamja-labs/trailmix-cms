import { Injectable, Logger } from '@nestjs/common';
import { AfterCreate, DatabaseHook } from '@trailmix-cms/core/better-auth';
import { EmailService } from '@trailmix-cms/core/email';

/**
 * Demonstrates a better-auth **database hook** (`@DatabaseHook` + `@AfterCreate`). Runs after
 * a `user` record is created — a good place for side effects like sending a welcome email or
 * enqueuing onboarding. Requires `databaseHooks: {}` in the better-auth config (see `app.module.ts`).
 *
 * It injects `EmailService` (from `@trailmix-cms/core/email`'s `EmailModule`) to show sending mail
 * through DI — the same `EmailSender` the auth flows use, swappable for any provider.
 */
@DatabaseHook()
@Injectable()
export class UserCreateHook {
    private readonly logger = new Logger(UserCreateHook.name);

    constructor(private readonly email: EmailService) {}

    @AfterCreate('user')
    async onUserCreated(user: { id: string; email: string; name?: string }) {
        this.logger.log(`New user created: ${user.email} (${user.id})`);
        await this.email.send({
            to: user.email,
            subject: 'Welcome to Trailmix CMS',
            html: `<p>Welcome${user.name ? `, ${user.name}` : ''}! Your account is ready.</p>`,
        });
    }
}
