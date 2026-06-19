import { Controller, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { AuthService, Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { RoleChangeResponseDto } from '../dto/dev.dto';

/**
 * **Test/dev convenience — do not ship anything like this.** Flips the better-auth admin-plugin
 * role on the *current* user so you can exercise the `@Roles(['admin'])` routes (e.g. the Admin
 * page) without an out-of-band way to mint your first admin.
 *
 * It is deliberately only session-protected (the global `AuthGuard`), with **no `@Roles` guard** —
 * the admin plugin's own `setRole` API requires the caller to already be an admin, so it can't
 * bootstrap one. We therefore write the role straight through better-auth's internal adapter.
 */
@ApiTags('test')
@ApiBearerAuth()
@Controller('test')
export class DevController {
    private readonly logger = new Logger(DevController.name);

    constructor(private readonly authService: AuthService) {}

    @Post('promote-admin')
    @ApiOperation({ summary: 'TEST ONLY — grant the current user the admin role' })
    @ZodResponse({ status: 200, description: 'Current user promoted to admin.', type: RoleChangeResponseDto })
    promote(@Session() session: UserSession) {
        return this.setRole(session.user.id, 'admin');
    }

    @Post('demote-admin')
    @ApiOperation({ summary: 'TEST ONLY — remove the admin role from the current user' })
    @ZodResponse({ status: 200, description: 'Current user demoted to a regular user.', type: RoleChangeResponseDto })
    demote(@Session() session: UserSession) {
        return this.setRole(session.user.id, 'user');
    }

    private async setRole(userId: string, role: 'admin' | 'user') {
        // `$context` resolves better-auth's internal adapter — the same one the admin plugin uses
        // to mutate user fields. `role` is a custom column the admin plugin adds, so it isn't on
        // the base `User` type; cast the update to reach it.
        const ctx = await this.authService.instance.$context;
        await ctx.internalAdapter.updateUser(userId, { role } as Record<string, unknown>);
        this.logger.warn(`TEST: set role of user ${userId} to '${role}'`);
        return {
            userId,
            role,
            message: `Role set to '${role}'. Refresh to re-read the session (sign out/in if it looks stale).`,
        };
    }
}
