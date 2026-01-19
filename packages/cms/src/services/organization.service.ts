import { Injectable, Logger, NotFoundException, Optional, Inject } from '@nestjs/common';
import { ObjectId, ClientSession } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { OrganizationCollection, RoleCollection } from '../collections';
import { OrganizationRoleService } from './organization-role.service';
import { DatabaseService } from '@trailmix-cms/db';
import { type OrganizationDeleteHook } from '../types/hooks/organization-delete-hook';
import { PROVIDER_SYMBOLS } from '../constants';

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
     * Delete an organization and cascade delete all associated organization roles.
     * This operation is atomic - if any part fails, the entire operation is rolled back.
     * 
     * @param organizationId - The ID of the organization to delete
     * @param auditContext - The audit context for tracking the deletion
     * @returns The deletion result
     * @throws NotFoundException if the organization doesn't exist
     */
    async deleteOrganization(
        organizationId: ObjectId,
        auditContext: models.AuditContext.Model,
    ): Promise<{ organizationDeleted: boolean; rolesDeletedCount: number }> {
        this.logger.log(`Deleting organization ${organizationId} with cascade delete of organization roles`);

        // First, verify the organization exists
        const organization = await this.organizationCollection.get(organizationId);
        if (!organization) {
            throw new NotFoundException(`Organization with id ${organizationId} not found`);
        }

        // Get all organization roles for this organization
        const organizationRoles = await this.organizationRoleService.find(organizationId);
        const rolesCount = organizationRoles.length;

        this.logger.log(`Found ${rolesCount} organization roles to delete for organization ${organizationId}`);

        // Use a single transaction to ensure atomicity of the cascade delete
        return await this.databaseService.withTransaction({}, async (session: ClientSession) => {
            let rolesDeletedCount = 0;

            // Delete all organization roles first (within the transaction)
            if (organizationRoles.length > 0) {
                const roleIds = organizationRoles.map(role => role._id);
                // Delete each role individually to ensure proper audit trail
                for (const roleId of roleIds) {
                    await this.roleCollection.deleteOne(roleId, auditContext, session);
                    rolesDeletedCount++;
                }
                this.logger.log(`Deleted ${rolesDeletedCount} organization roles`);
            }

            // Call the organization delete hook if provided (within the same transaction)
            // This allows developers to delete additional records as part of the same atomic operation
            if (this.organizationDeleteHook) {
                this.logger.log(`Calling organization delete hook for organization ${organizationId}`);
                await this.organizationDeleteHook.onHook(organizationId, organization, auditContext, session);
            }

            // Delete the organization itself (within the same transaction)
            await this.organizationCollection.deleteOne(organizationId, auditContext, session);
            this.logger.log(`Deleted organization ${organizationId}`);

            return {
                organizationDeleted: true,
                rolesDeletedCount,
            };
        });
    }
}