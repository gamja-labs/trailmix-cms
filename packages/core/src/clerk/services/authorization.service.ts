import { Injectable, Logger, Optional } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as models from '@trailmix-cms/models';
import * as trailmixModels from '@trailmix-cms/models';
import { GlobalRoleService } from './global-role.service.js';
import { OrganizationRoleService } from './organization-role.service.js';
import { RequestPrincipal } from '../types/index.js';
// Reuse core's security-audit collection (the agnostic core registers it).
import { SecurityAuditCollection } from '../../collections/index.js';

@Injectable()
export class AuthorizationService {
    private readonly logger = new Logger(AuthorizationService.name);

    constructor(
        private readonly globalRoleService: GlobalRoleService,
        private readonly securityAuditCollection: SecurityAuditCollection,
        @Optional() private readonly organizationRoleService?: OrganizationRoleService,
    ) { }

    /**
     * Check if a principal is a global admin.
     */
    async isGlobalAdmin(principalId: ObjectId, principalType: models.Principal): Promise<boolean> {
        const globalRoles = await this.globalRoleService.findOne({
            principal_id: principalId,
            principal_type: principalType,
            role: models.RoleValue.Admin,
        });
        return !!globalRoles;
    }

    async resolveOrganizationAuthorization(params: {
        principal: RequestPrincipal,
        rolesAllowList: string[],
        principalTypeAllowList: models.Principal[],
        organizationId: ObjectId,
    }) {
        const { principal, rolesAllowList, principalTypeAllowList, organizationId } = params;

        const principal_id = principal.entity._id;
        const principal_type = principal.principal_type;
        const globalRoles = await this.globalRoleService.find({
            principal_id,
            principal_type
        });
        const isGlobalAdmin = globalRoles.some(role => role.role === models.RoleValue.Admin);

        if (!this.organizationRoleService) {
            throw new Error('OrganizationRoleService is not available. Organizations feature must be enabled to use resolveOrganizationAuthorization.');
        }

        const organizationRoles = await this.organizationRoleService.find({
            principal_id,
            principal_type,
            organization_id: organizationId,
        });

        const hasAccess = isGlobalAdmin ||
            (
                organizationRoles.some(role => {
                    return rolesAllowList.includes(role.role);
                }) &&
                principalTypeAllowList.includes(principal_type)
            );

        return { hasAccess, isGlobalAdmin, globalRoles, organizationRoles };
    }

    async authorizeApiKeyAccessForPrincipal(principal: RequestPrincipal, apiKeyScopeType: trailmixModels.ApiKeyScope, apiKeyScopeId?: ObjectId): Promise<boolean> {
        // Global admins have access to all API keys
        const isGlobalAdmin = await this.isGlobalAdmin(principal.entity._id, principal.principal_type);
        if (isGlobalAdmin) {
            return true;
        }

        switch (apiKeyScopeType) {
            case trailmixModels.ApiKeyScope.Global: {
                await this.securityAuditCollection.insertOne({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principal.entity._id,
                    principal_type: principal.principal_type,
                    message: 'Unauthorized attempt to get global-scoped API key for non-global admins',
                    source: AuthorizationService.name,
                });
                return false;
            }
            case trailmixModels.ApiKeyScope.Account: {
                if (!apiKeyScopeId) {
                    throw new Error('API key scope ID is required for account-scoped API keys');
                }
                if (!apiKeyScopeId.equals(principal.entity._id)) {
                    await this.securityAuditCollection.insertOne({
                        event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                        principal_id: principal.entity._id,
                        principal_type: principal.principal_type,
                        message: 'Unauthorized attempt to get account-scoped API key for another principal',
                        source: AuthorizationService.name,
                    });
                    return false;
                }
                return true;
            }
            case trailmixModels.ApiKeyScope.Organization: {
                if (!apiKeyScopeId) {
                    throw new Error('API key scope ID is required for organization-scoped API keys');
                }
                const requiredRoles = [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner];
                const accessResult = await this.resolveOrganizationAuthorization({
                    principal,
                    rolesAllowList: requiredRoles,
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: apiKeyScopeId!,
                });
                if (!accessResult.hasAccess) {
                    await this.securityAuditCollection.insertOne({
                        event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                        principal_id: principal.entity._id,
                        principal_type: principal.principal_type,
                        message: `Unauthorized attempt to get organization-scoped API key without ${requiredRoles} role on the organization ${apiKeyScopeId}`,
                        source: AuthorizationService.name,
                    });
                    return false;
                }
                return true;
            }
            default: {
                throw new Error(`Invalid scope type: ${apiKeyScopeType}`);
            }
        }
    }
}
