import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';

import * as trailmixModels from '@trailmix-cms/models';

import { AuthorizationService, GlobalRoleService, OrganizationRoleService } from '@/services';
import { SecurityAuditCollection } from '@/collections/security-audit.collection';
import { RequestPrincipal } from '@/types';

import * as TestUtils from '../../utils';

describe('AuthorizationService', () => {
    let service: AuthorizationService;
    let organizationRoleService: jest.Mocked<OrganizationRoleService>;
    let globalRoleService: jest.Mocked<GlobalRoleService>;
    let securityAuditCollection: jest.Mocked<SecurityAuditCollection>;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockOrganizationRoleService = {
            find: jest.fn(),
            findOne: jest.fn(),
        };

        const mockGlobalRoleService = {
            findOne: jest.fn(),
            find: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthorizationService,
                {
                    provide: OrganizationRoleService,
                    useValue: mockOrganizationRoleService,
                },
                {
                    provide: GlobalRoleService,
                    useValue: mockGlobalRoleService,
                },
                {
                    provide: SecurityAuditCollection,
                    useValue: mockSecurityAuditCollection,
                },
            ],
        }).compile();

        service = module.get<AuthorizationService>(AuthorizationService);
        organizationRoleService = module.get(OrganizationRoleService);
        globalRoleService = module.get(GlobalRoleService);
        securityAuditCollection = module.get(SecurityAuditCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore Logger methods after all tests
        jest.restoreAllMocks();
    });

    describe('isGlobalAdmin', () => {
        it('returns true when principal has Admin role (ensuring Admin role grants global admin access)', async () => {
            const principalId = new ObjectId();
            const principalType = trailmixModels.Principal.Account;
            const adminRole = TestUtils.Models.createGlobalRoleModel({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });

            globalRoleService.findOne.mockResolvedValue(adminRole);

            const result = await service.isGlobalAdmin(principalId, principalType);

            expect(result).toBe(true);
            expect(globalRoleService.findOne).toHaveBeenCalledWith({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });
        });

        it('returns false when principal does not have Admin role (ensuring non-admin roles do not grant global admin access)', async () => {
            const principalId = new ObjectId();
            const principalType = trailmixModels.Principal.Account;

            globalRoleService.findOne.mockResolvedValue(null);

            const result = await service.isGlobalAdmin(principalId, principalType);

            expect(result).toBe(false);
            expect(globalRoleService.findOne).toHaveBeenCalledWith({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });
        });

        it('returns false when principal has no global roles (ensuring missing roles do not grant global admin access)', async () => {
            const principalId = new ObjectId();
            const principalType = trailmixModels.Principal.Account;

            globalRoleService.findOne.mockResolvedValue(null);

            const result = await service.isGlobalAdmin(principalId, principalType);

            expect(result).toBe(false);
            expect(globalRoleService.findOne).toHaveBeenCalledWith({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });
        });

        it('returns true when principal has Admin role (ensuring Admin role is detected)', async () => {
            const principalId = new ObjectId();
            const principalType = trailmixModels.Principal.Account;
            const adminRole = TestUtils.Models.createGlobalRoleModel({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });

            globalRoleService.findOne.mockResolvedValue(adminRole);

            const result = await service.isGlobalAdmin(principalId, principalType);

            expect(result).toBe(true);
        });

        it('works correctly for ApiKey principal type (ensuring ApiKey principals can be global admins)', async () => {
            const principalId = new ObjectId();
            const principalType = trailmixModels.Principal.ApiKey;
            const adminRole = TestUtils.Models.createGlobalRoleModel({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });

            globalRoleService.findOne.mockResolvedValue(adminRole);

            const result = await service.isGlobalAdmin(principalId, principalType);

            expect(result).toBe(true);
            expect(globalRoleService.findOne).toHaveBeenCalledWith({
                principal_id: principalId,
                principal_type: principalType,
                role: trailmixModels.RoleValue.Admin,
            });
        });
    });

    describe('resolveOrganizationAuthorization', () => {
        const principalId = new ObjectId();
        const accountEntity = TestUtils.Entities.createAccount({ _id: principalId });
        const accountPrincipal: RequestPrincipal = {
            principal_type: trailmixModels.Principal.Account,
            entity: accountEntity,
        };
        const organizationId = new ObjectId();

        it('throws error when OrganizationRoleService is not available (ensuring organizations feature must be enabled)', async () => {
            // Create a service instance without OrganizationRoleService
            const moduleWithoutOrgService: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthorizationService,
                    {
                        provide: GlobalRoleService,
                        useValue: {
                            findOne: jest.fn(),
                            find: jest.fn().mockResolvedValue([]),
                        },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: {
                            insertOne: jest.fn().mockResolvedValue(undefined),
                        },
                    },
                ],
            }).compile();

            const serviceWithoutOrgService = moduleWithoutOrgService.get<AuthorizationService>(AuthorizationService);

            await expect(
                serviceWithoutOrgService.resolveOrganizationAuthorization({
                    principal: accountPrincipal,
                    rolesAllowList: [trailmixModels.RoleValue.Admin],
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId,
                })
            ).rejects.toThrow('OrganizationRoleService is not available. Organizations feature must be enabled to use resolveOrganizationAuthorization.');
        });

        it('returns hasAccess true when principal is a global admin (ensuring global admins have access to all organizations)', async () => {
            const adminGlobalRole = TestUtils.Models.createGlobalRoleModel({
                principal_id: principalId,
                principal_type: trailmixModels.Principal.Account,
                role: trailmixModels.RoleValue.Admin,
            });
            globalRoleService.find.mockResolvedValue([adminGlobalRole]);
            organizationRoleService.find.mockResolvedValue([]);

            const result = await service.resolveOrganizationAuthorization({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(true);
            expect(result.isGlobalAdmin).toBe(true);
            expect(result.globalRoles).toEqual([adminGlobalRole]);
            expect(result.organizationRoles).toEqual([]);
            expect(globalRoleService.find).toHaveBeenCalledWith({
                principal_id: principalId,
                principal_type: trailmixModels.Principal.Account,
            });
        });

        it('returns hasAccess true when Account principal has matching role (ensuring Account principals with matching roles have access)', async () => {
            globalRoleService.find.mockResolvedValue([]);
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: principalId,
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationRoleService.find.mockResolvedValue([organizationRole]);

            const result = await service.resolveOrganizationAuthorization({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(true);
            expect(result.isGlobalAdmin).toBe(false);
            expect(result.organizationRoles).toEqual([organizationRole]);
        });

        it('returns hasAccess false when Account principal has non-matching role (ensuring non-matching roles are rejected)', async () => {
            globalRoleService.find.mockResolvedValue([]);
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: principalId,
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationRoleService.find.mockResolvedValue([organizationRole]);

            const result = await service.resolveOrganizationAuthorization({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(false);
            expect(result.isGlobalAdmin).toBe(false);
            expect(result.organizationRoles).toEqual([organizationRole]);
        });

        it('returns hasAccess true when ApiKey principal has matching role and is in principalTypeAllowList (ensuring ApiKey principals can have access when allowed)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };
            globalRoleService.find.mockResolvedValue([]);
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: apiKeyEntity._id,
                principal_type: trailmixModels.Principal.ApiKey,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationRoleService.find.mockResolvedValue([organizationRole]);

            const result = await service.resolveOrganizationAuthorization({
                principal: apiKeyPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId,
            });

            expect(result.hasAccess).toBe(true);
            expect(result.isGlobalAdmin).toBe(false);
            expect(result.organizationRoles).toEqual([organizationRole]);
        });

        it('returns hasAccess false when ApiKey principal is not in principalTypeAllowList (ensuring ApiKey principals are rejected when not allowed)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };
            globalRoleService.find.mockResolvedValue([]);
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: apiKeyEntity._id,
                principal_type: trailmixModels.Principal.ApiKey,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationRoleService.find.mockResolvedValue([organizationRole]);

            const result = await service.resolveOrganizationAuthorization({
                principal: apiKeyPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(false);
            expect(result.isGlobalAdmin).toBe(false);
            expect(result.organizationRoles).toEqual([organizationRole]);
        });

        it('returns hasAccess false when principal has no organization roles (ensuring missing roles are rejected)', async () => {
            globalRoleService.find.mockResolvedValue([]);
            organizationRoleService.find.mockResolvedValue([]);

            const result = await service.resolveOrganizationAuthorization({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(false);
            expect(result.isGlobalAdmin).toBe(false);
            expect(result.organizationRoles).toEqual([]);
        });

        it('returns hasAccess true when principal has role matching one in rolesAllowList array (ensuring array role matching works)', async () => {
            globalRoleService.find.mockResolvedValue([]);
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: principalId,
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Owner,
            });
            organizationRoleService.find.mockResolvedValue([organizationRole]);

            const result = await service.resolveOrganizationAuthorization({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account],
                organizationId,
            });

            expect(result.hasAccess).toBe(true);
            expect(result.isGlobalAdmin).toBe(false);
        });
    });

    describe('authorizeApiKeyAccessForPrincipal', () => {
        const principalId = new ObjectId();
        const accountEntity = TestUtils.Entities.createAccount({ _id: principalId });
        const accountPrincipal: RequestPrincipal = {
            principal_type: trailmixModels.Principal.Account,
            entity: accountEntity,
        };

        describe('Global scope', () => {
            it('returns true when principal is a global admin (ensuring global admins can access global-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: principalId,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.Admin,
                    }),
                );

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Global
                );

                expect(result).toBe(true);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns false and logs security audit when principal is not a global admin (ensuring non-admins are blocked and audited)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Global
                );

                expect(result).toBe(false);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    message: 'Unauthorized attempt to get global-scoped API key for non-global admins',
                    source: AuthorizationService.name,
                });
            });
        });

        describe('Account scope', () => {
            it('returns true when scope ID matches principal ID (ensuring principals can access their own account-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                const scopeId = principalId;

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Account,
                    scopeId
                );

                expect(result).toBe(true);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns true when principal is a global admin even if scope ID does not match (ensuring global admins can access any account-scoped API key)', async () => {
                globalRoleService.findOne.mockResolvedValue(
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: principalId,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.Admin,
                    }),
                );
                const scopeId = new ObjectId();

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Account,
                    scopeId
                );

                expect(result).toBe(true);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('throws Error when scope ID is missing (ensuring scope ID is required for account-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);

                await expect(
                    service.authorizeApiKeyAccessForPrincipal(
                        accountPrincipal,
                        trailmixModels.ApiKeyScope.Account
                    )
                ).rejects.toThrow(Error);
            });

            it('returns false and logs security audit when scope ID does not match principal ID (ensuring principals cannot access other accounts\' API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                const scopeId = new ObjectId();

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Account,
                    scopeId
                );

                expect(result).toBe(false);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    message: 'Unauthorized attempt to get account-scoped API key for another principal',
                    source: AuthorizationService.name,
                });
            });
        });

        describe('Organization scope', () => {
            const organizationId = new ObjectId();

            it('returns true when principal has Admin role on organization (ensuring Admin role grants access to organization-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                globalRoleService.find.mockResolvedValue([]);
                const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationId,
                    role: trailmixModels.RoleValue.Admin,
                });
                organizationRoleService.find.mockResolvedValue([organizationRole]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(true);
                expect(organizationRoleService.find).toHaveBeenCalledWith({
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationId,
                });
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns true when principal has Owner role on organization (ensuring Owner role grants access to organization-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                globalRoleService.find.mockResolvedValue([]);
                const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationId,
                    role: trailmixModels.RoleValue.Owner,
                });
                organizationRoleService.find.mockResolvedValue([organizationRole]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(true);
            });

            it('returns true when principal is a global admin (ensuring global admins can access any organization-scoped API key)', async () => {
                globalRoleService.findOne.mockResolvedValue(
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: principalId,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.Admin,
                    }),
                );
                globalRoleService.find.mockResolvedValue([
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: principalId,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.Admin,
                    }),
                ]);
                organizationRoleService.find.mockResolvedValue([]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(true);
            });

            it('throws Error when scope ID is missing (ensuring scope ID is required for organization-scoped API keys)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);

                await expect(
                    service.authorizeApiKeyAccessForPrincipal(
                        accountPrincipal,
                        trailmixModels.ApiKeyScope.Organization
                    )
                ).rejects.toThrow(Error);
                await expect(
                    service.authorizeApiKeyAccessForPrincipal(
                        accountPrincipal,
                        trailmixModels.ApiKeyScope.Organization
                    )
                ).rejects.toThrow('API key scope ID is required for organization-scoped API keys');
            });

            it('returns false and logs security audit when principal does not have required role (ensuring insufficient roles are blocked and audited)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                globalRoleService.find.mockResolvedValue([]);
                organizationRoleService.find.mockResolvedValue([]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(false);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized attempt to get organization-scoped API key without ${[trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner]} role on the organization ${organizationId}`,
                    source: AuthorizationService.name,
                });
            });

            it('returns false and logs security audit when principal has insufficient role (ensuring User role does not grant access)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);
                globalRoleService.find.mockResolvedValue([]);
                const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: principalId,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationId,
                    role: trailmixModels.RoleValue.User,
                });
                organizationRoleService.find.mockResolvedValue([organizationRole]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    accountPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(false);
                expect(securityAuditCollection.insertOne).toHaveBeenCalled();
            });

            it('returns false for ApiKey principal type (ensuring ApiKey principals cannot access organization-scoped API keys)', async () => {
                const apiKeyEntity = TestUtils.Entities.createApiKey();
                const apiKeyPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.ApiKey,
                    entity: apiKeyEntity,
                };
                globalRoleService.findOne.mockResolvedValue(null);
                globalRoleService.find.mockResolvedValue([]);
                const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: apiKeyEntity._id,
                    principal_type: trailmixModels.Principal.ApiKey,
                    organization_id: organizationId,
                    role: trailmixModels.RoleValue.Admin,
                });
                organizationRoleService.find.mockResolvedValue([organizationRole]);

                const result = await service.authorizeApiKeyAccessForPrincipal(
                    apiKeyPrincipal,
                    trailmixModels.ApiKeyScope.Organization,
                    organizationId
                );

                expect(result).toBe(false);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: apiKeyEntity._id,
                    principal_type: trailmixModels.Principal.ApiKey,
                    message: `Unauthorized attempt to get organization-scoped API key without ${[trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner]} role on the organization ${organizationId}`,
                    source: AuthorizationService.name,
                });
            });
        });

        describe('Invalid scope type', () => {
            it('throws Error for invalid scope type (ensuring invalid scopes are rejected)', async () => {
                globalRoleService.findOne.mockResolvedValue(null);

                await expect(
                    service.authorizeApiKeyAccessForPrincipal(
                        accountPrincipal,
                        'invalid_scope' as trailmixModels.ApiKeyScope
                    )
                ).rejects.toThrow(Error);
                await expect(
                    service.authorizeApiKeyAccessForPrincipal(
                        accountPrincipal,
                        'invalid_scope' as trailmixModels.ApiKeyScope
                    )
                ).rejects.toThrow('Invalid scope type: invalid_scope');
            });
        });
    });
});
