import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { OrgRoles, Session, type UserSession } from '@trailmix-cms/core/better-auth';

import { ActiveOrgSettingsResponseDto } from '../dto/organizations.dto';

/**
 * Demonstrates `@OrgRoles()` — organization-scoped RBAC backed by the better-auth
 * organization plugin. It checks the member's role in the *active* organization and requires
 * `activeOrganizationId` on the session (set via `POST /api/auth/organization/set-active`).
 */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
    @Get('active/settings')
    @OrgRoles(['owner', 'admin'])
    @ApiOperation({ summary: 'Active-organization settings — requires org owner/admin role' })
    @ZodResponse({ status: 200, description: 'Active-organization settings.', type: ActiveOrgSettingsResponseDto })
    activeSettings(@Session() session: UserSession) {
        return {
            activeOrganizationId: session.session.activeOrganizationId,
            message: 'You are an owner/admin of the active organization.',
        };
    }
}
