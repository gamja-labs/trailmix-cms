import { ObjectId } from 'mongodb';
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';
import * as trailmixModels from '@trailmix-cms/models';
import { ObjectIdPipe } from '@trailmix-cms/utils';

import { Auth, AuditContext, PrincipalContext } from '../decorators';
import * as dto from '../dto/organization-role.dto';
import { type RequestPrincipal } from '../types';
import { OrganizationRoleManager } from '../managers';

@Auth()
@ApiTags('organization-roles')
@Controller('organization-roles')
export class OrganizationRolesController {
    constructor(
        private readonly organizationRoleManager: OrganizationRoleManager,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Assign an organization role to a principal' })
    @ApiCreatedResponse({ description: 'Organization role assigned successfully.', type: dto.OrganizationRoleListResponseDto })
    async assignRole(
        @Body() assignRoleDto: dto.AssignOrganizationRoleDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ): Promise<dto.OrganizationRoleListResponseDto> {
        const role = await this.organizationRoleManager.insertOne(
            {
                organization_id: assignRoleDto.organization_id,
                principal_id: assignRoleDto.principal_id,
                principal_type: assignRoleDto.principal_type,
                role: assignRoleDto.role,
            },
            principal,
            auditContext,
        );

        return {
            items: [role],
            count: 1,
        };
    }

    @Get()
    @ApiOperation({ summary: 'Get all organization role assignments' })
    @ApiOkResponse({ description: 'Organization role assignments found.', type: dto.OrganizationRoleListResponseDto })
    async getOrganizationRoleAssignments(
        @Query() queryParams: dto.GetOrganizationRoleAssignmentsQueryDto,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<dto.OrganizationRoleListResponseDto> {
        const result = await this.organizationRoleManager.find(
            {
                organization_id: queryParams.organization_id,
                principal_id: queryParams.principal_id,
                principal_type: queryParams.principal_type,
                role: queryParams.role,
            },
            principal,
        );
        return {
            items: result,
            count: result.length,
        };
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'Organization role assignment ID', type: String })
    @ApiOperation({ summary: 'Get an organization role assignment' })
    @ApiOkResponse({ description: 'Organization role assignment found.', type: dto.OrganizationRoleDto })
    async getOrganizationRoleAssignment(
        @Param('id', ObjectIdPipe) id: ObjectId,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<dto.OrganizationRoleDto> {
        return await this.organizationRoleManager.get(id, principal);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', description: 'Organization role assignment ID', type: String })
    @ApiOperation({ summary: 'Remove an organization role assignment' })
    @ApiOkResponse({ description: 'Organization role removed successfully.' })
    async removeRole(
        @Param('id', ObjectIdPipe) id: ObjectId,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ): Promise<{ success: boolean }> {
        await this.organizationRoleManager.deleteOne(id, principal, auditContext);
        return { success: true };
    }
}
