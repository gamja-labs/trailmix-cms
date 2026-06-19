import { Controller, Get, Param, Logger, Put, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import * as trailmixModels from '@trailmix-cms/models';

import { AuditContext, Auth, PrincipalContext } from '../decorators/index.js';
import { type RequestPrincipal } from '../types/index.js';
import { OrganizationByIdPipe } from '../pipes/organization.pipe.js';
import { OrganizationManager } from '../managers/organization.manager.js';
import { OrganizationResponseDto, OrganizationListResponseDto, UpdateOrganizationDto } from '../dto/organization.dto.js';

@Auth()
@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
    readonly logger = new Logger(OrganizationsController.name);

    constructor(
        readonly organizationManager: OrganizationManager,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all organizations' })
    @ZodResponse({ status: 200, description: 'Organizations found.', type: OrganizationListResponseDto })
    async getOrganizations(
        @PrincipalContext() principal: RequestPrincipal,
    ) {
        this.logger.log('Getting all organizations');
        const organizations = await this.organizationManager.find({}, principal);

        return {
            items: organizations,
            count: organizations.length,
        };
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'Organization ID' })
    @ApiOperation({ summary: 'Get an organization by ID' })
    @ZodResponse({ status: 200, description: 'Organization found.', type: OrganizationResponseDto })
    async getOrganization(
        @PrincipalContext() principal: RequestPrincipal,
        @Param('id', OrganizationByIdPipe) organization: trailmixModels.Organization.Entity
    ) {
        return await this.organizationManager.get(organization, principal);
    }

    @Put(':id')
    @ApiParam({ name: 'id', description: 'Organization ID' })
    @ApiOperation({ summary: 'Update an organization by ID' })
    @ZodResponse({ status: 200, description: 'Organization updated.', type: OrganizationResponseDto })
    async updateOrganization(
        @PrincipalContext() principal: RequestPrincipal,
        @Param('id', OrganizationByIdPipe) organization: trailmixModels.Organization.Entity,
        @Body() update: UpdateOrganizationDto,
        @AuditContext() auditContext: trailmixModels.AuditContext.Model,
    ) {
        return await this.organizationManager.update(
            organization,
            update,
            principal,
            auditContext,
        );
    }
}
