import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException, Optional, Inject, ForbiddenException } from '@nestjs/common';
import { Filter, ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';
import { Utils } from '@trailmix-cms/db';

import { ApiKeyCollection, OrganizationCollection, SecurityAuditCollection } from '../collections';
import { AuthorizationService } from './authorization.service';
import { FeatureService } from './feature.service';
import { RequestPrincipal } from '../types';

export type GetApiKeysParams = {
    name?: string;
    disabled?: boolean;
    scope_type?: trailmixModels.ApiKeyScope;
    scope_id?: ObjectId;
};

@Injectable()
export class ApiKeyService {
    private readonly logger = new Logger(ApiKeyService.name);

    constructor(
        private readonly apiKeyCollection: ApiKeyCollection,
        private readonly securityAuditCollection: SecurityAuditCollection,
        private readonly featureService: FeatureService,
        private readonly authorizationService: AuthorizationService,
        @Optional() @Inject(OrganizationCollection) private readonly organizationCollection: OrganizationCollection | undefined,
    ) { }

    /**
     * Create a new API key with scope validation and authorization checks
     */
    async createApiKey(
        params: Utils.Creatable<trailmixModels.ApiKey.Entity>,
        principal: RequestPrincipal,
        auditContext: trailmixModels.AuditContext.Model,
    ): Promise<trailmixModels.ApiKey.Entity> {
        this.logger.log(`Creating API key with scope ${params.scope_type} for principal ${principal.entity._id}`);

        // Check if scopes are configured and validate the requested scope
        const allowedScopes = this.featureService.getApiKeyScopes();
        if (!allowedScopes.includes(params.scope_type)) {
            await this.securityAuditCollection.insertOne({
                event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: `Unauthorized attempt to create API key with scope ${params.scope_type} which is not in the allowed scopes`,
                source: ApiKeyService.name,
            });
            throw new BadRequestException(`Scope type ${params.scope_type} is not allowed. Allowed scopes: ${allowedScopes.join(', ')}`);
        }

        const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(principal.entity._id, principal.principal_type);
        switch (params.scope_type) {
            case trailmixModels.ApiKeyScope.Global: {
                // Global-scoped: principal must be a global admin
                if (!isGlobalAdmin) {
                    await this.securityAuditCollection.insertOne({
                        event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                        principal_id: principal.entity._id,
                        principal_type: principal.principal_type,
                        message: 'Unauthorized attempt to create global-scoped API key',
                        source: ApiKeyService.name,
                    });
                    throw new BadRequestException('Invalid scope type');
                }

                if (params.scope_id) {
                    throw new BadRequestException('Scope ID is not allowed for global-scoped API keys');
                }

                const apiKey = await this.apiKeyCollection.create(params, auditContext);
                this.logger.log(`Successfully created API key ${apiKey._id} with scope ${params.scope_type}`);
                return apiKey;
            }
            case trailmixModels.ApiKeyScope.Account: {
                // Account-scoped: principal must be the account owner
                if (!params.scope_id) {
                    throw new BadRequestException('Scope ID is required for account-scoped API keys');
                }

                if (isGlobalAdmin) {
                    const apiKey = await this.apiKeyCollection.create(params, auditContext);
                    this.logger.log(`Successfully created API key ${apiKey._id} with scope ${params.scope_type}`);
                    return apiKey;
                }

                if(principal.principal_type !== trailmixModels.Principal.Account) {
                    throw new BadRequestException('Only accounts can create account-scoped API keys');
                }

                if (!principal.entity._id.equals(params.scope_id)) {
                    await this.securityAuditCollection.insertOne({
                        event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                        principal_id: principal.entity._id,
                        principal_type: principal.principal_type,
                        message: 'Unauthorized attempt to create account-scoped API key for another principal',
                        source: ApiKeyService.name,
                    });
                    throw new BadRequestException('Scope ID must match principal ID for account-scoped API keys');
                }
                const apiKey = await this.apiKeyCollection.create(params, auditContext);
                this.logger.log(`Successfully created API key ${apiKey._id} with scope ${params.scope_type}`);
                return apiKey;
            }
            case trailmixModels.ApiKeyScope.Organization: {
                // Organization-scoped: principal must have admin/owner role on the organization
                if (!this.featureService.isOrganizationsEnabled()) {
                    this.logger.warn('Organizations feature must be enabled to create organization-scoped API keys');
                    throw new BadRequestException();
                }
                if (!this.organizationCollection) {
                    this.logger.error('Organization collections and services are not available despite organizations feature being enabled');
                    throw new InternalServerErrorException();
                }
                if (!params.scope_id) {
                    throw new BadRequestException('Scope ID is required for organization-scoped API keys');
                }

                if (isGlobalAdmin) {
                    const apiKey = await this.apiKeyCollection.create(params, auditContext);
                    this.logger.log(`Successfully created API key ${apiKey._id} with scope ${params.scope_type}`);
                    return apiKey;
                }

                const requiredRoles = [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner];
                // Check if user has admin or owner role on the organization
                const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
                    principal,
                    rolesAllowList: requiredRoles,
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: params.scope_id,
                });

                if (!accessResult.hasAccess) {
                    await this.securityAuditCollection.insertOne({
                        event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                        principal_id: principal.entity._id,
                        principal_type: principal.principal_type,
                        message: `Unauthorized attempt to create organization-scoped API key for organization ${params.scope_id}`,
                        source: ApiKeyService.name,
                    });

                    // If the principal has at least reader organization role, throw a forbidden exception since they have access to the organization
                    if (accessResult.organizationRoles.some(role =>
                        ([
                            trailmixModels.RoleValue.Owner,
                            trailmixModels.RoleValue.Admin,
                            trailmixModels.RoleValue.User,
                            trailmixModels.RoleValue.Reader,
                        ] as string[]
                        ).includes(role.role))) {
                        throw new ForbiddenException(`Insufficient permissions to create API keys for organization ${params.scope_id}. You must have at lesat one of ${requiredRoles} role on the organization.`);
                    }
                    throw new BadRequestException(`Organization ${params.scope_id} does not exist `);
                }

                const apiKey = await this.apiKeyCollection.create(params, auditContext,);
                this.logger.log(`Successfully created API key ${apiKey._id} with scope ${params.scope_type}`);
                return apiKey;
            }
            default: {
                throw new InternalServerErrorException('Invalid scope type');
            }
        }
    }

    /**
     * Get API keys with filtering based on principal permissions
     */
    async getApiKeys(
        principal: RequestPrincipal,
        queryParams: GetApiKeysParams,
    ): Promise<{ items: trailmixModels.ApiKey.Entity[]; count: number }> {
        this.logger.log(`Getting API keys for principal ${principal.entity._id}`);

        const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(principal.entity._id, principal.principal_type);
        if (isGlobalAdmin) {
            const filter: Filter<trailmixModels.ApiKey.Entity> = {
                ...(queryParams.name ? { name: queryParams.name } : {}),
                ...(queryParams.disabled ? { disabled: queryParams.disabled } : {}),
                ...(queryParams.scope_type ? { "scope.type": queryParams.scope_type } : {}),
                ...(queryParams.scope_id ? { "scope.id": queryParams.scope_id } : {}),
            };
            const apiKeys = await this.apiKeyCollection.find(filter);
            return {
                items: apiKeys,
                count: apiKeys.length,
            };
        }

        // Non global admins
        if (!queryParams.scope_type) {
            throw new BadRequestException('Scope type is required');
        }

        // Global-scoped API keys are not supported for non-global admins
        if (queryParams.scope_type?.includes(trailmixModels.ApiKeyScope.Global)) {
            await this.securityAuditCollection.insertOne({
                event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: principal.entity._id,
                principal_type: principal.principal_type,
                message: 'Unauthorized attempt to get global-scoped API keys for non-global admins',
                source: ApiKeyService.name,
            });
            throw new BadRequestException('Global-scoped API keys are not supported for non-global admins');
        }

        switch (queryParams.scope_type) {
            case trailmixModels.ApiKeyScope.Account: {
                // Account-scoped API keys
                const filter: Filter<trailmixModels.ApiKey.Entity> = {
                    ...(queryParams.name ? { name: queryParams.name } : {}),
                    ...(queryParams.disabled ? { disabled: queryParams.disabled } : {}),
                    "scope.type": trailmixModels.ApiKeyScope.Account,
                    "scope.id": principal.entity._id,
                };
                const apiKeys = await this.apiKeyCollection.find(filter);
                return {
                    items: apiKeys,
                    count: apiKeys.length,
                };
            }
            case trailmixModels.ApiKeyScope.Organization: {
                // Organization-scoped API keys
                if (!this.featureService.isOrganizationsEnabled()) {
                    throw new BadRequestException('Organizations feature must be enabled to query organization-scoped API keys');
                }
                if (!queryParams.scope_id) {
                    throw new BadRequestException('Scope ID is required for organization-scoped API keys');
                }

                const organization_id = queryParams.scope_id;
                const requiredRoles = [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner];
                // Check if user has admin or owner role on the organization
                const accessResult = await this.authorizationService.resolveOrganizationAuthorization({
                    principal,
                    rolesAllowList: requiredRoles,
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: organization_id,
                });

                if (!accessResult.hasAccess) {
                    throw new ForbiddenException(`Insufficient permissions to create API keys for organization ${organization_id}. You must have at lesat one of ${requiredRoles} role on the organization.`);
                }

                const filter: Filter<trailmixModels.ApiKey.Entity> = {
                    ...(queryParams.name ? { name: queryParams.name } : {}),
                    ...(queryParams.disabled ? { disabled: queryParams.disabled } : {}),
                    "scope.type": trailmixModels.ApiKeyScope.Organization,
                    "scope.id": organization_id,
                };
                const apiKeys = await this.apiKeyCollection.find(filter);
                return {
                    items: apiKeys,
                    count: apiKeys.length,
                };
            }
            default: {
                throw new InternalServerErrorException('Invalid scope type');
            }
        }
    }

    /**
     * Get a single API key by entity, checking authorization
     */
    async getApiKey(
        apiKey: trailmixModels.ApiKey.Entity,
        principal: RequestPrincipal,
    ): Promise<trailmixModels.ApiKey.Entity> {
        const hasAccess = await this.authorizationService.authorizeApiKeyAccessForPrincipal(principal, apiKey.scope_type, apiKey.scope_id);
        if (!hasAccess) {
            throw new NotFoundException('API key not found');
        }

        return apiKey;
    }

    /**
     * Delete an API key, checking authorization first
     */
    async deleteApiKey(
        apiKey: trailmixModels.ApiKey.Entity,
        principal: RequestPrincipal,
        auditContext: trailmixModels.AuditContext.Model,
    ): Promise<void> {
        const hasAccess = await this.authorizationService.authorizeApiKeyAccessForPrincipal(principal, apiKey.scope_type, apiKey.scope_id);
        if (!hasAccess) {
            throw new NotFoundException('API key not found');
        }

        await this.apiKeyCollection.deleteOne(apiKey._id, auditContext);
        this.logger.log(`Successfully deleted API key ${apiKey._id}`);
    }
}
