import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key set by {@link RequireAdmin}. Auth integration packages read it to enforce the
 * admin requirement — e.g. `@trailmix-cms/core` registers a guard keyed on this.
 */
export const REQUIRE_ADMIN_KEY = 'trailmix:require-admin';

/**
 * Marks a controller or route handler as requiring an authenticated **admin** principal.
 *
 * Core ships only the marker — it does **not** enforce it, keeping core auth-agnostic. Your auth
 * integration package supplies the enforcement (it knows how to resolve roles from the request):
 * `@trailmix-cms/core`'s setup registers a guard that reads this metadata and checks the
 * better-auth `admin` plugin's role. Without such a guard the marker is inert.
 *
 * @example
 * ```ts
 * @RequireAdmin()
 * @Controller('security-audits')
 * export class SecurityAuditsController {}
 * ```
 */
export const RequireAdmin = () => SetMetadata(REQUIRE_ADMIN_KEY, true);
