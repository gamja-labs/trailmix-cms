import { Injectable, Logger, NotFoundException, Optional, Inject } from '@nestjs/common';
import { ObjectId, ClientSession } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { DatabaseService } from '@trailmix-cms/db';
import { OrganizationCollection, RoleCollection } from '../collections/index.js';
import { OrganizationRoleService } from './organization-role.service.js';
import { type OrganizationDeleteHook } from '../types/hooks/organization-delete-hook.js';
import { PROVIDER_SYMBOLS } from '../provider-symbols.js';

@Injectable()
export class OrganizationService {
    private readonly logger = new Logger(OrganizationService.name);

    constructor(
        private readonly organizationCollection: OrganizationCollection,
        private readonly roleCollection: RoleCollection,
        private readonly organizationRoleService: OrganizationRoleService,
        private readonly databaseService: DatabaseService,
        @Optional() @Inject(PROVIDER_SYMBOLS.ORGANIZATION_DELETE_HOOK) private organizationDeleteHook?: OrganizationDeleteHook,
    ) { }

    /**
     * Delete an organization and cascade delete all associated organization roles, atomically.
     * @throws NotFoundException if the organization doesn't exist
     */
    async deleteOrganization(
        organizationId: ObjectId,
        auditContext: models.AuditContext.Model,
    ): Promise<{ organizationDeleted: boolean; rolesDeletedCount: number }> {
        this.logger.log(`Deleting organization ${organizationId} with cascade delete of organization roles`);

        const organization = await this.organizationCollection.get(organizationId);
        if (!organization) {
            throw new NotFoundException(`Organization with id ${organizationId} not found`);
        }

        const organizationRoles = await this.organizationRoleService.find(organizationId);
        const rolesCount = organizationRoles.length;

        this.logger.log(`Found ${rolesCount} organization roles to delete for organization ${organizationId}`);

        return await this.databaseService.withTransaction({}, async (session: ClientSession) => {
            let rolesDeletedCount = 0;

            if (organizationRoles.length > 0) {
                const roleIds = organizationRoles.map(role => role._id);
                for (const roleId of roleIds) {
                    await this.roleCollection.deleteOne(roleId, auditContext, session);
                    rolesDeletedCount++;
                }
                this.logger.log(`Deleted ${rolesDeletedCount} organization roles`);
            }

            if (this.organizationDeleteHook) {
                this.logger.log(`Calling organization delete hook for organization ${organizationId}`);
                await this.organizationDeleteHook.onHook(organizationId, organization, auditContext, session);
            }

            await this.organizationCollection.deleteOne(organizationId, auditContext, session);
            this.logger.log(`Deleted organization ${organizationId}`);

            return {
                organizationDeleted: true,
                rolesDeletedCount,
            };
        });
    }
}
