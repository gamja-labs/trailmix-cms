import { Injectable, Logger, Inject, Optional, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAuth } from '@clerk/fastify';
import * as trailmixModels from '@trailmix-cms/models';
import { AccountCollection, ApiKeyCollection } from '../collections/index.js';
// Reuse core's security-audit collection.
import { SecurityAuditCollection } from '../../collections/index.js';
import { AccountService } from './account.service.js';
import { GlobalRoleService } from './global-role.service.js';
import { PROVIDER_SYMBOLS } from '../provider-symbols.js';
import { type AuthGuardHook, type RequestPrincipal } from '../types/index.js';

export const AuthResult = {
    IsValid: 'isValid',
    Unauthorized: 'unauthorized',
    Forbidden: 'forbidden',
} as const;

export type AuthResult = typeof AuthResult[keyof typeof AuthResult];

/**
 * Resolves and validates the {@link RequestPrincipal}. The **only Clerk coupling** in the provider:
 * {@link AuthService.getAccount} maps a Clerk user (via `@clerk/fastify`'s `getAuth`) to a local
 * account; everything else is provider-agnostic (API keys, global roles).
 */
@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private accountService: AccountService,
        private accountCollection: AccountCollection,
        private globalRoleService: GlobalRoleService,
        private securityAuditCollection: SecurityAuditCollection,
        @Optional() @Inject(PROVIDER_SYMBOLS.AUTH_GUARD_HOOK) private authGuardHook?: AuthGuardHook,
        @Optional() private apiKeyCollection?: ApiKeyCollection,
    ) { }

    /**
     * Validate authentication and authorization for a request.
     */
    async validateAuth(
        principal: RequestPrincipal | null,
        config: {
            allowAnonymous: boolean,
            requiredPrincipalTypes: trailmixModels.Principal[],
            requiredGlobalRoles: (trailmixModels.RoleValue | string)[],
            requiredApiKeyScopes: (trailmixModels.ApiKeyScope | string)[],
        },
        requestUrl: string,
    ): Promise<AuthResult> {
        const { allowAnonymous, requiredPrincipalTypes, requiredGlobalRoles, requiredApiKeyScopes } = config;

        if (!principal) {
            if (allowAnonymous) {
                return AuthResult.IsValid;
            }
            return AuthResult.Unauthorized;
        }

        if (allowAnonymous) {
            return AuthResult.IsValid;
        }

        if (requiredPrincipalTypes.length > 0 && !requiredPrincipalTypes.includes(principal.principal_type)) {
            await this.securityAuditCollection.insertOne(
                {
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principal.entity._id,
                    principal_type: principal.principal_type,
                    message: `Unauthorized access to ${requestUrl}, required principal type not found: ${requiredPrincipalTypes.join(', ')}`,
                    source: AuthService.name,
                }
            );
            return AuthResult.Forbidden;
        }

        if (principal.principal_type === trailmixModels.Principal.ApiKey && requiredApiKeyScopes.length > 0 && !requiredApiKeyScopes.includes(principal.entity.scope_type)) {
            await this.securityAuditCollection.insertOne(
                {
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principal.entity._id,
                    principal_type: principal.principal_type,
                    message: `Unauthorized access to ${requestUrl}, required API key scope is not allowed:${requiredApiKeyScopes.join(', ')}`,
                    source: AuthService.name,
                }
            );
            return AuthResult.Forbidden;
        }

        if (requiredGlobalRoles.length == 0) {
            return AuthResult.IsValid;
        }

        const globalRoleAssignments = await this.globalRoleService.find({
            principal_id: principal.entity._id,
            principal_type: principal.principal_type,
        });

        if (!globalRoleAssignments) {
            await this.securityAuditCollection.insertOne(
                {
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principal.entity._id,
                    principal_type: principal.principal_type,
                    message: `Unauthorized access to ${requestUrl}, no global role assignments found`,
                    source: AuthService.name,
                }
            );

            return AuthResult.Forbidden;
        }

        const hasRole = requiredGlobalRoles.some((role) =>
            globalRoleAssignments.some((assignment) => assignment.role === role)) ||
            globalRoleAssignments.some((assignment) => assignment.role === trailmixModels.RoleValue.Admin);

        if (!hasRole) {
            await this.securityAuditCollection.insertOne(
                {
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principal.entity._id,
                    principal_type: principal.principal_type,
                    message: `Unauthorized access to ${requestUrl}, required role not found: ${requiredGlobalRoles.join(', ')}`,
                    source: AuthService.name,
                }
            );
            return AuthResult.Forbidden;
        }

        return AuthResult.IsValid;
    }

    /**
     * Get the account from the request principal; for an account-scoped API key, returns the
     * associated account.
     */
    async getAccountFromPrincipal(principal: RequestPrincipal): Promise<trailmixModels.Account.Entity | null> {
        if (principal.principal_type === trailmixModels.Principal.Account) {
            return principal.entity;
        }

        const apiKey = principal.entity;

        if (apiKey.scope_type !== trailmixModels.ApiKeyScope.Account) {
            throw new Error('API key is not account-scoped');
        }

        const account = await this.accountCollection.findOne({ _id: apiKey.scope_id });
        if (!account) {
            throw new Error('Account not found');
        }

        return account;
    }

    /**
     * Get the principal from the request context. API keys take precedence over Clerk accounts.
     */
    async getPrincipal(context: ExecutionContext): Promise<RequestPrincipal | null> {
        const apiKey = await this.getApiKey(context);
        if (apiKey) {
            return {
                entity: apiKey,
                principal_type: trailmixModels.Principal.ApiKey,
            };
        }

        const account = await this.getAccount(context);

        if (!account) {
            return null;
        }

        return {
            entity: account,
            principal_type: trailmixModels.Principal.Account,
        };
    }

    private async getAccount(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const auth = getAuth(request)

        if (!auth.userId) {
            return null;
        }

        const existingAccount = await this.accountService.getAccount(auth.userId);
        if (existingAccount) {
            return existingAccount;
        }

        const account = await this.accountService.upsertAccount(auth.userId);

        // TODO: Lock this step to prevent race conditions
        if (this.authGuardHook) {
            const authGuardHookresult = await this.authGuardHook.onHook(account!);
            if (!authGuardHookresult) {
                this.logger.error('Failed to validate account using auth guard hook', {
                    userId: auth.userId,
                    accountId: account?._id,
                });
                throw new Error('Failed to validate account using auth guard hook');
            }
        }

        return account;
    }

    private async getApiKey(context: ExecutionContext) {
        if (!this.apiKeyCollection) {
            return null;
        }

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const apiKey = request.headers[trailmixModels.API_KEY_HEADER];

        if (!apiKey) {
            return null;
        }

        const apiKeyEntity = await this.apiKeyCollection.findOne({ api_key: apiKey });

        if (!apiKeyEntity || apiKeyEntity.disabled) {
            return null;
        }

        return apiKeyEntity;
    }
}
