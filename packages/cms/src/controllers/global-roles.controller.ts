import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiParam } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';
import { ObjectIdPipe } from '@trailmix-cms/utils';
import * as trailmixModels from '@trailmix-cms/models';

import { Auth, AuditContext, PrincipalContext } from '../decorators';
import { GlobalRoleManager } from '../managers';
import * as dto from '../dto/global-role.dto';
import { type RequestPrincipal } from '../types';

@Auth({ globalRoles: [trailmixModels.RoleValue.Admin] })
@ApiTags('global-roles')
@Controller('global-roles')
export class GlobalRolesController {
    constructor(
        private readonly globalRoleManager: GlobalRoleManager,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Assign a global role to a principal' })
    @ApiCreatedResponse({ description: 'Global role assigned successfully.', type: dto.GlobalRoleDto })
    async assignRole(
        @Body() assignRoleDto: dto.AssignGlobalRoleDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ): Promise<dto.GlobalRoleDto> {
        const role = await this.globalRoleManager.insertOne({
            principal_id: assignRoleDto.principal_id,
            principal_type: assignRoleDto.principal_type,
            role: assignRoleDto.role,
        }, principal, auditContext);

        return role;
    }

    @Get()
    @ApiOperation({ summary: 'Get all global role assignments' })
    @ApiOkResponse({ description: 'Global role assignments found.', type: dto.GlobalRoleListResponseDto })
    async getGlobalRoleAssignments(
        @Query() queryParams: dto.GetGlobalRoleAssignmentsQueryDto,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<dto.GlobalRoleListResponseDto> {
        const roles = await this.globalRoleManager.find({
            principal_id: queryParams.principal_id,
            principal_type: queryParams.principal_type,
            role: queryParams.role,
        }, principal);
        return { items: roles, count: roles.length };
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'Global role assignment ID', type: String })
    @ApiOperation({ summary: 'Get a global role assignment' })
    @ApiOkResponse({ description: 'Global role assignment found.', type: dto.GlobalRoleDto })
    async getGlobalRoleAssignment(
        @Param('id', ObjectIdPipe) id: ObjectId,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<dto.GlobalRoleDto> {
        return await this.globalRoleManager.get(id, principal);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', description: 'Global role assignment ID', type: String })
    @ApiOperation({ summary: 'Remove a global role assignment' })
    @ApiOkResponse({ description: 'Global role removed successfully.' })
    async removeRole(
        @Param('id', ObjectIdPipe) id: ObjectId,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ): Promise<{ success: boolean }> {
        await this.globalRoleManager.deleteOne(id, principal, auditContext);
        return { success: true };
    }
}
