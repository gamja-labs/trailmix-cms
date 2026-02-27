import { Injectable, Logger, InternalServerErrorException, Inject, Optional, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAuth } from '@clerk/fastify';
import * as trailmixModels from '@trailmix-cms/models';
import { AccountCollection, ApiKeyCollection, SecurityAuditCollection } from '../collections';
import { AccountService } from './account.service';
import { GlobalRoleService } from './global-role.service';
import { PROVIDER_SYMBOLS } from '../constants';
import { type AuthGuardHook, type RequestPrincipal } from '../types';

export const AuthResult = {
    IsValid: 'isValid',
    Unauthorized: 'unauthorized',
    Forbidden: 'forbidden',
} as const;

export type AuthResult = typeof AuthResult[keyof typeof AuthResult];

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
     * Validate authentication and authorization for a request
     * @param principal The principal from the request (null if not authenticated)
     * @param config The authentication configuration
     * @param requestUrl The request URL for audit logging
     * @returns AuthResult
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

        // Check if principal type is required, if no required principal types, allow any principal type
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

        // Check if API key scope is required, if no required API key scopes, allow any API key scope
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

        // If no roles are required, allow any authenticated principal
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

        // Check if user has required role or is global admin
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
     * Get the account from the request principal, if the principal is an account API key, it will return the account associated with the API key
     * @param principal The principal
     * @returns The account
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
     * Get the principal from the request context
     * @param context The execution context
     * @returns The principal or null if not found
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

        // TODO: Cache user
        // const cachedUser = await this.userCache.getUser(auth.userId);
        // if (cachedUser) {
        //     return {
        //         account: cachedUser.account,
        //         userPublicMetadata: cachedUser.metadata,
        //     };
        // }

        const existingAccount = await this.accountService.getAccount(auth.userId);
        if (existingAccount) {
            return existingAccount;
        }

        const account = await this.accountService.upsertAccount(auth.userId);

        // TODO: Lock this step to prevent race conditions
        this.logger.log(`Validating account using auth guard hook: ${auth.userId}`);
        this.logger.log(`Auth guard hook: ${this.authGuardHook}`);
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

        // TODO: Cache user
        // await this.userCache.cacheUser(auth.userId, {
        //     account: account!,
        //     metadata: user.publicMetadata,
        // });

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

        // TODO: Cache api key
        const apiKeyEntity = await this.apiKeyCollection.findOne({ api_key: apiKey });

        if (!apiKeyEntity || apiKeyEntity.disabled) {
            return null;
        }

        return apiKeyEntity;
    }


}
