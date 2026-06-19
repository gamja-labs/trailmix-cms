import { Injectable, Logger } from '@nestjs/common';
import { type AuthHookContext, BeforeHook, Hook } from '@trailmix-cms/core/better-auth';
import { APIError } from 'better-auth/api';

const BLOCKED_DOMAINS = ['blocked.example'];

/**
 * Demonstrates a better-auth **request hook** (`@Hook` + `@BeforeHook`). Runs before the
 * `/sign-up/email` endpoint; throw an `APIError` to reject the request. Requires `hooks: {}`
 * in the better-auth config (see `auth.ts`).
 */
@Hook()
@Injectable()
export class SignUpHook {
    private readonly logger = new Logger(SignUpHook.name);

    @BeforeHook('/sign-up/email')
    async enforceEmailDomain(ctx: AuthHookContext) {
        const email = String((ctx.body as { email?: string } | undefined)?.email ?? '');
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && BLOCKED_DOMAINS.includes(domain)) {
            this.logger.warn(`Rejected sign-up from blocked domain: ${email}`);
            throw new APIError('BAD_REQUEST', { message: `Sign-ups from ${domain} are not allowed.` });
        }
    }
}
