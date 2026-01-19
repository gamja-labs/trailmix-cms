import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import { Utils } from '@trailmix-cms/db';

import { GlobalRoleService, AuthorizationService } from '../services';
import { RequestPrincipal } from '../types';
import { SecurityAuditCollection } from '../collections';

export type CreateGlobalRoleParams = Utils.Creatable<models.GlobalRole.Model>;
export type FindGlobalRolesParams = Partial<models.GlobalRole.Model>;

@Injectable()
export class GlobalRoleManager {
    private readonly logger = new Logger(GlobalRoleManager.name);

    constructor(
        private readonly globalRoleService: GlobalRoleService,
        private readonly authorizationService: AuthorizationService,
        private readonly securityAuditCollection: SecurityAuditCollection,
    ) { }

    private async authorizeGlobalAdmin(principal: RequestPrincipal, message: string) {
        const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(principal.entity._id, principal.principal_type);
        if (!isGlobalAdmin) {
            await this.securityAuditCollection.insertOne({
                event_type: models.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: message,
                source: GlobalRoleManager.name,
            });
            throw new ForbiddenException(message);
        }
    }

    async insertOne(
        params: CreateGlobalRoleParams,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ) {
        this.logger.log(`Assigning global role ${params.role} to principal ${params.principal_id} (${params.principal_type})`);

        await this.authorizeGlobalAdmin(principal, 'Insufficient permissions to create global role');

        // Check if role already exists
        const existing = await this.globalRoleService.findOne(params);
        if (existing) {
            throw new BadRequestException('Global role already assigned to this principal');
        }

        // Create the role
        const result = await this.globalRoleService.insertOne(params, auditContext);
        return result;
    }

    async find(
        query: FindGlobalRolesParams,
        principal: RequestPrincipal,
    ) {
        this.logger.log(`Getting global role assignments for query: ${JSON.stringify(query)}`);

        await this.authorizeGlobalAdmin(principal, 'Insufficient permissions to find global roles');

        const roles = await this.globalRoleService.find(query);

        return roles;
    }

    async get(
        id: ObjectId,
        principal: RequestPrincipal,
    ) {
        await this.authorizeGlobalAdmin(principal, 'Insufficient permissions to get global roles');

        const role = await this.globalRoleService.findOne({ _id: id });
        if (!role) {
            throw new NotFoundException('Global role not found');
        }

        return role;
    }

    async deleteOne(
        id: ObjectId,
        principal: RequestPrincipal,
        auditContext: models.AuditContext.Model,
    ) {
        await this.authorizeGlobalAdmin(principal, 'Insufficient permissions to remove global roles');

        const role = await this.globalRoleService.findOne({ _id: id });
        if (!role) {
            throw new NotFoundException('Global role not found');
        }

        await this.globalRoleService.deleteOne(id, auditContext);
        this.logger.log(`Removed global role ${id}`);
    }
}
