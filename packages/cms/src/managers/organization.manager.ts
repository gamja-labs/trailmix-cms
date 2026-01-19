import { Injectable, Logger, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Filter, ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { Utils } from '@trailmix-cms/db';

import { OrganizationCollection, SecurityAuditCollection } from '../collections';
import { AuthorizationService, OrganizationRoleService, OrganizationService } from '../services';
import { RequestPrincipal } from '../types';


export type UpdateOrganizationParams = Partial<Utils.Creatable<models.Organization.Entity>>;
export type FindOrganizationsParams = Partial<Utils.Creatable<models.Organization.Entity>>;

@Injectable()
export class OrganizationManager {
    private readonly logger = new Logger(OrganizationManager.name);

    constructor(
        private readonly organizationCollection: OrganizationCollection,
        private readonly authorizationService: AuthorizationService,
        private readonly organizationRoleService: OrganizationRoleService,
        private readonly organizationService: OrganizationService,
        private readonly securityAuditCollection: SecurityAuditCollection,
    ) { }

    private async authorizeAdminOrganizationAccess(params: {
        organizationId: ObjectId;
        principal: RequestPrincipal;
        securityAuditMessage: string;
    }) {
        const { organizationId, principal, securityAuditMessage } = params;

        const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [
                models.RoleValue.Admin,
                models.RoleValue.Owner,
            ],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: organizationId,
        });

        if (!accessResult.hasAccess) {
            await this.securityAuditCollection.insertOne({
                event_type: models.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: securityAuditMessage,
                source: OrganizationManager.name,
            });
            // If the principal has at least reader organization role, throw a forbidden exception since they have access to the organization
            if (accessResult.organizationRoles.some(role =>
                ([
                    models.RoleValue.Owner,
                    models.RoleValue.Admin,
                    models.RoleValue.User,
                    models.RoleValue.Reader,
                ] as string[]
                ).includes(role.role))) {
                throw new ForbiddenException(`Insufficient permissions to perform this action on organization ${organizationId}`);
            }
            throw new NotFoundException(`Organization ${organizationId} not found`);
        }
    }

    private async authorizeReaderOrganizationAccess(params: {
        organizationId: ObjectId;
        principal: RequestPrincipal;
        securityAuditMessage: string;
    }) {
        const { organizationId, principal, securityAuditMessage } = params;

        const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [
                models.RoleValue.Owner,
                models.RoleValue.Admin,
                models.RoleValue.User,
                models.RoleValue.Reader,
            ],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: organizationId,
        });

        if (!accessResult.hasAccess) {
            await this.securityAuditCollection.insertOne({
                event_type: models.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: securityAuditMessage,
                source: OrganizationManager.name,
            });
            throw new NotFoundException(`Organization ${organizationId} not found`);
        }

        return accessResult;
    }

    async find(
        filter: FindOrganizationsParams,
        principal: RequestPrincipal,
    ) {
        this.logger.log(`Finding organizations with filter: ${JSON.stringify(filter)}`);

        // Global admins can see all organizations
        const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(
            principal.entity._id,
            principal.principal_type,
        );
        if (isGlobalAdmin) {
            return await this.organizationCollection.find(filter);
        }

        // Non-global admins can only see organizations they belong to
        const organizationRoles = await this.organizationRoleService.find({
            principal_id: principal.entity._id,
            principal_type: principal.principal_type,
            role: {
                $in: [
                    models.RoleValue.Owner,
                    models.RoleValue.Admin,
                    models.RoleValue.User,
                    models.RoleValue.Reader,
                ]
            },
        } as Filter<models.OrganizationRole.Model>);

        const organizationIds = organizationRoles.map(role => role.organization_id);
        if (organizationIds.length === 0) {
            return [];
        }

        const query: Filter<models.Organization.Entity> = {
            ...filter,
            _id: { $in: organizationIds },
        };

        return await this.organizationCollection.find(query);
    }

    async get(
        organization: models.Organization.Entity,
        principal: RequestPrincipal,
    ) {
        // Check authorization - user must be global admin or organization member
        await this.authorizeReaderOrganizationAccess({
            organizationId: organization._id,
            principal,
            securityAuditMessage: `Insufficient permissions to access organization ${organization._id}`,
        });

        return organization;
    }

    async update(
        organization: models.Organization.Entity,
        update: UpdateOrganizationParams,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ) {
        this.logger.log(`Updating organization ${organization._id}`);

        // Check authorization - user must be global admin or organization admin
        await this.authorizeAdminOrganizationAccess({
            organizationId: organization._id,
            principal,
            securityAuditMessage: `Unauthorized attempt to update organization ${organization._id}`,
        });

        const updatedOrganization = await this.organizationCollection.findOneAndUpdate(
            { _id: organization._id },
            update,
            auditContext,
        );

        if (!updatedOrganization) {
            throw new InternalServerErrorException('Organization not found after update');
        }

        return updatedOrganization;
    }

    async delete(
        organization: models.Organization.Entity,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ): Promise<void> {
        this.logger.log(`Deleting organization ${organization._id}`);

        // Check authorization - user must be global admin or organization admin
        await this.authorizeAdminOrganizationAccess({
            organizationId: organization._id,
            principal,
            securityAuditMessage: `Unauthorized attempt to delete organization ${organization._id}`,
        });

        // Use the service's deleteOrganization method which handles cascade delete with transactions
        await this.organizationService.deleteOrganization(organization._id, auditContext);
        this.logger.log(`Deleted organization ${organization._id}`);
    }
}
