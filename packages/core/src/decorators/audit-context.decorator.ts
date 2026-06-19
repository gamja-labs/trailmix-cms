import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';

/**
 * The shape of the authenticated user your auth integration attaches to the request once its
 * guard has resolved a session (e.g. `@trailmix-cms/core` sets `request.user`).
 */
type AuthenticatedUser = { id: string; [key: string]: unknown };

type RequestWithSession = FastifyRequest & {
    user?: AuthenticatedUser;
    session?: { user?: AuthenticatedUser } & Record<string, unknown>;
};

/**
 * Builds an {@link models.AuditContext.Model} for the authenticated user currently attached to the
 * request.
 *
 * The Trailmix `principal_id` is ALWAYS the **user's `_id`** (`user._id`) — not the `account`
 * document's `_id` and not the provider-side `accountId`. better-auth's MongoDB adapter exposes
 * `user.id` as the hex string of that `user._id`, so it maps directly onto the `ObjectId` we store.
 * A user may own many `account` records (one per login method); attribution is keyed to the stable
 * user identity, so audit and security-audit records are owned by `user._id`.
 *
 * @throws InternalServerErrorException if the user id is not a valid ObjectId.
 */
export function createAuditContextForUser(user: { id: string }): models.AuditContext.Model {
    if (!ObjectId.isValid(user.id)) {
        throw new InternalServerErrorException(`Authenticated user id "${user.id}" is not a valid ObjectId.`);
    }
    return {
        principal_id: new ObjectId(user.id),
        principal_type: models.Principal.Account,
        system: false,
    };
}

/** An {@link models.AuditContext.Model} representing a non-user, system initiated action. */
export const systemAuditContext = (): models.AuditContext.Model => ({ system: true });

/**
 * Controller parameter decorator that injects the {@link models.AuditContext.Model}
 * for the currently authenticated user.
 *
 * The route must be protected by your auth integration's guard (e.g. the global `AuthGuard`
 * `@trailmix-cms/core` registers) so that a session is present on the request.
 *
 * @example
 * ```ts
 * @Post()
 * create(@Body() body: CreateThingDto, @AuditContext() auditContext: AuditContext.Model) {
 *   return this.things.insertOne(body, auditContext);
 * }
 * ```
 */
export const AuditContext = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): models.AuditContext.Model => {
        const request = ctx.switchToHttp().getRequest<RequestWithSession>();
        const user = request.user ?? request.session?.user;
        if (!user?.id) {
            throw new InternalServerErrorException(
                'No authenticated user found on the request. Ensure the route is protected by your auth integration’s guard.',
            );
        }
        return createAuditContextForUser(user);
    },
);
