import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { REQUIRE_ADMIN_KEY } from '../decorators/index.js';

type AuthenticatedUser = { role?: string | string[]; [key: string]: unknown };
type RequestWithSession = FastifyRequest & {
    user?: AuthenticatedUser;
    session?: { user?: AuthenticatedUser } & Record<string, unknown>;
};

/** Roles asserted by the better-auth `admin` plugin are stored as a comma-separated string. */
function resolveRoles(user: AuthenticatedUser | undefined): string[] {
    if (!user?.role) return [];
    return (Array.isArray(user.role) ? user.role : user.role.split(','))
        .map((r) => r.trim())
        .filter(Boolean);
}

/**
 * Enforces `@trailmix-cms/core`'s {@link REQUIRE_ADMIN_KEY} marker ({@link RequireAdmin}) using the
 * better-auth `admin` plugin's role on the request.
 *
 * Registered globally by {@link setupTrailmixAuth} (after `@thallesp/nestjs-better-auth`'s
 * `AuthGuard`, which populates `request.user`), so core's `security-audits` controller — marked
 * `@RequireAdmin()` but auth-agnostic — is restricted to admins. Requires the better-auth `admin`
 * plugin to be enabled on the auth instance.
 */
@Injectable()
export class TrailmixAdminGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requireAdmin = this.reflector.getAllAndOverride<boolean>(REQUIRE_ADMIN_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requireAdmin) return true;

        const request = context.switchToHttp().getRequest<RequestWithSession>();
        const user = request.user ?? request.session?.user;
        if (!resolveRoles(user).includes('admin')) {
            throw new ForbiddenException('Admin role required.');
        }
        return true;
    }
}
