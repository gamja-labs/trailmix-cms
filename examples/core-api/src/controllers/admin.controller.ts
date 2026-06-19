import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Roles, Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { AdminOverviewResponseDto } from '../dto/admin.dto';

/**
 * Demonstrates `@Roles()` — system-level RBAC backed by the better-auth admin plugin. It
 * checks `user.role` only; an organization admin cannot reach these routes. Applied at the
 * class level, so every route here requires `user.role === 'admin'` (403 otherwise).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(['admin'])
@Controller('admin')
export class AdminController {
    @Get('overview')
    @ApiOperation({ summary: 'System-admin only (better-auth admin plugin role)' })
    @ZodResponse({ status: 200, description: 'Admin overview.', type: AdminOverviewResponseDto })
    overview(@Session() session: UserSession) {
        return { message: 'Welcome, admin.', you: session.user.email, role: session.user.role };
    }
}
