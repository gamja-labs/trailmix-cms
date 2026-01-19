import { z, ZodType } from 'zod';
import { Filter } from 'mongodb';
import { Controller, Get, Param, Logger, NotFoundException, Inject, Put, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import * as trailmixModels from '@trailmix-cms/models';

import { AuditContext, Auth, PrincipalContext } from '../decorators';
import { type RequestPrincipal } from '../types';
import { OrganizationByIdPipe } from '../pipes/organization.pipe';
import { PROVIDER_SYMBOLS } from '../constants';
import { OrganizationManager } from '../managers/organization.manager';

export function buildOrganizationsController<
    OrganizationEntity extends trailmixModels.Organization.Entity = trailmixModels.Organization.Entity,
    OrganizationDtoEntity = OrganizationEntity
>(
    organizationSchema: any = trailmixModels.Organization.schema,
) {

    class OrganizationDto extends createZodDto(organizationSchema) { }

    const UpdateOrganizationSchema = organizationSchema.omit(trailmixModels.InternalFields);
    class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }

    const OrganizationListResponseSchema = z.object({
        items: z.array(organizationSchema),
        count: z.number(),
    });
    class OrganizationListResponseDto extends createZodDto(OrganizationListResponseSchema) { }


    @Auth()
    @ApiTags('organizations')
    @Controller('organizations')
    class OrganizationsController {
        readonly logger = new Logger(OrganizationsController.name);

        constructor(
            @Inject(PROVIDER_SYMBOLS.ORGANIZATION_MAP_ENTITY) readonly organizationMapEntity: (entity: OrganizationEntity) => OrganizationDtoEntity,
            readonly organizationManager: OrganizationManager,
        ) { }

        @Get()
        @ApiOperation({ summary: 'Get all organizations' })
        @ApiOkResponse({ description: 'Organizations found.', type: OrganizationListResponseDto })
        async getOrganizations(
            @PrincipalContext() principal: RequestPrincipal,
        ): Promise<OrganizationListResponseDto> {
            this.logger.log('Getting all organizations');
            const organizations = await this.organizationManager.find({}, principal);

            return {
                items: organizations.map((organization: trailmixModels.Organization.Entity) => this.organizationMapEntity(organization as OrganizationEntity)),
                count: organizations.length,
            };
        }

        @Get(':id')
        @ApiParam({ name: 'id', description: 'Organization ID' })
        @ApiOperation({ summary: 'Get an organization by ID' })
        @ApiOkResponse({ description: 'Organization found.', type: OrganizationDto })
        async getOrganization(
            @PrincipalContext() principal: RequestPrincipal,
            @Param('id', OrganizationByIdPipe) organization: trailmixModels.Organization.Entity
        ): Promise<OrganizationDtoEntity> {
            const org = await this.organizationManager.get(organization, principal);
            return this.organizationMapEntity(org as OrganizationEntity);
        }

        @Put(':id')
        @ApiParam({ name: 'id', description: 'Organization ID' })
        @ApiOperation({ summary: 'Update an organization by ID' })
        @ApiOkResponse({ description: 'Organization updated.', type: OrganizationDto })
        async updateOrganization(
            @PrincipalContext() principal: RequestPrincipal,
            @Param('id', OrganizationByIdPipe) organization: trailmixModels.Organization.Entity,
            @Body() update: UpdateOrganizationDto,
            @AuditContext() auditContext: trailmixModels.AuditContext.Model,
        ): Promise<OrganizationDtoEntity> {
            const updatedOrganization = await this.organizationManager.update(
                organization,
                update,
                principal,
                auditContext,
            );
            return this.organizationMapEntity(updatedOrganization as OrganizationEntity);
        }
    }

    return OrganizationsController;
}

export const OrganizationsController = buildOrganizationsController();