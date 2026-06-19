import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { Utils } from '@trailmix-cms/db';

import { OrganizationRoleService, AuthorizationService } from '../services/index.js';
import { OrganizationCollection } from '../collections/index.js';
// Reuse core's security-audit collection.
import { SecurityAuditCollection } from '../../collections/index.js';
import { RequestPrincipal } from '../types/index.js';

export type CreateOrganizationRoleParams = Utils.Creatable<models.OrganizationRole.Model>;
export type FindOrganizationRoleParams = Partial<Utils.Creatable<models.OrganizationRole.Model>>;

@Injectable()
export class OrganizationRoleManager {
    private readonly logger = new Logger(OrganizationRoleManager.name);

    constructor(
        private readonly organizationRoleService: OrganizationRoleService,
        private readonly authorizationService: AuthorizationService,
        private readonly organizationCollection: OrganizationCollection,
        private readonly securityAuditCollection: SecurityAuditCollection,
    ) { }

    private async verifyOrganizationExists(organizationId: ObjectId) {
        const organization = await this.organizationCollection.get(organizationId);
        if (!organization) {
            throw new BadRequestException('Organization not found');
        }
    }

    private async authorizeOrganizationAdmin(params: {
        organizationId: ObjectId;
        principal: RequestPrincipal;
    }) {
        const { organizationId, principal } = params;
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
                message: `Insufficient permissions to access organization roles for organization ${organizationId}`,
                source: OrganizationRoleManager.name,
            });
            if (accessResult.organizationRoles.some(role =>
                ([
                    models.RoleValue.Admin,
                    models.RoleValue.Owner,
                    models.RoleValue.User,
                    models.RoleValue.Reader,
                ] as string[]
                ).includes(role.role))) {
                throw new ForbiddenException(`Insufficient permissions to access organization roles for organization ${organizationId}`);
            }
            throw new BadRequestException(`Organization ${organizationId} not found`);
        }

        return accessResult;
    }

    async insertOne(
        params: CreateOrganizationRoleParams,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ) {
        this.logger.log(`Assigning organization role ${params.role} to principal ${params.principal_id} (${params.principal_type}) in organization ${params.organization_id}`);

        await this.verifyOrganizationExists(params.organization_id);

        await this.authorizeOrganizationAdmin({
            organizationId: params.organization_id,
            principal: principal
        });

        const existing = await this.organizationRoleService.findOne(params);
        if (existing) {
            throw new BadRequestException('Organization role already assigned to this principal in this organization');
        }

        return await this.organizationRoleService.insertOne(params, auditContext);
    }

    async find(
        params: FindOrganizationRoleParams,
        principal: RequestPrincipal,
    ) {
        this.logger.log(`Getting organization role assignments for query: ${JSON.stringify(params)}`);
        const { organization_id } = params;
        if (!organization_id) {
            const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(principal.entity._id, principal.principal_type);
            if (!isGlobalAdmin) {
                throw new BadRequestException('organization_id is required');
            }
            return await this.organizationRoleService.find(params);
        }

        await this.verifyOrganizationExists(organization_id);

        const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [
                models.RoleValue.Admin,
                models.RoleValue.Owner,
            ],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: organization_id,
        });
        if (accessResult.hasAccess) {
            return await this.organizationRoleService.find(params);
        }

        if (params.principal_id &&
            !params.principal_id.equals(principal.entity._id)) {
            throw new BadRequestException('You cannot view organization roles for other principals');
        }

        if (params.principal_type &&
            params.principal_type !== principal.principal_type) {
            throw new BadRequestException('You cannot view organization roles for other principal types');
        }

        return accessResult.organizationRoles;
    }

    async get(
        id: ObjectId,
        principal: RequestPrincipal,
    ) {
        const role = await this.organizationRoleService.findOne({ _id: id });
        if (!role) {
            throw new NotFoundException('Organization role not found');
        }

        const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [
                models.RoleValue.Admin,
                models.RoleValue.Owner,
            ],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: role.organization_id,
        });

        if (!accessResult.hasAccess &&
            !accessResult.organizationRoles.some(role =>
                ([
                    models.RoleValue.Admin,
                    models.RoleValue.Owner,
                    models.RoleValue.User,
                    models.RoleValue.Reader,
                ] as string[]).includes(role.role))
        ) {
            await this.securityAuditCollection.insertOne({
                event_type: models.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: `Insufficient permissions to access organization role ${role._id} for organization ${role.organization_id}`,
                source: OrganizationRoleManager.name,
            });

            throw new BadRequestException(`Organization role ${role._id} not found for organization ${role.organization_id}`);
        }

        if (
            !role.principal_id.equals(principal.entity._id) ||
            role.principal_type !== principal.principal_type
        ) {
            throw new NotFoundException('Organization role not found');
        }

        return role;
    }

    async deleteOne(
        roleId: ObjectId,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ): Promise<void> {
        this.logger.log(`Removing organization role assignment ${roleId}`);

        const role = await this.organizationRoleService.findOne({ _id: roleId });
        if (!role) {
            throw new NotFoundException('Organization role not found');
        }

        await this.authorizeOrganizationAdmin({
            organizationId: role.organization_id,
            principal: principal,
        });

        await this.organizationRoleService.deleteOne(roleId, auditContext);
        this.logger.log(`Removed organization role ${roleId}`);
    }
}
