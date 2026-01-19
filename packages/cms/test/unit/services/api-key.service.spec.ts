import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { faker } from '@faker-js/faker';

import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { ApiKeyService, GetApiKeysParams } from '@/services';
import { ApiKeyCollection, OrganizationCollection, SecurityAuditCollection } from '@/collections';
import { AuthorizationService } from '@/services/authorization.service';
import { FeatureService } from '@/services/feature.service';
import { RequestPrincipal } from '@/types';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';
import { Utils } from '@trailmix-cms/db';

describe('ApiKeyService', () => {
    let service: ApiKeyService;
    let apiKeyCollection: jest.Mocked<ApiKeyCollection>;
    let authorizationService: jest.Mocked<AuthorizationService>;
    let securityAuditCollection: jest.Mocked<SecurityAuditCollection>;
    let featureService: jest.Mocked<FeatureService>;
    let organizationCollection: jest.Mocked<OrganizationCollection>;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
        const mockApiKeyCollection = {
            create: jest.fn(),
            find: jest.fn(),
            deleteOne: jest.fn(),
        };

        const mockAuthorizationService = {
            isGlobalAdmin: jest.fn(),
            resolveOrganizationAuthorization: jest.fn(),
            authorizeApiKeyAccessForPrincipal: jest.fn(),
        };

        const mockOrganizationCollection = {
            findOne: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const mockFeatureService = {
            isOrganizationsEnabled: jest.fn().mockReturnValue(true),
            isFileEnabled: jest.fn(),
            isTextEnabled: jest.fn(),
            isApiKeysEnabled: jest.fn(),
            getApiKeyScopes: jest.fn().mockReturnValue([trailmixModels.ApiKeyScope.Account, trailmixModels.ApiKeyScope.Organization, trailmixModels.ApiKeyScope.Global]), // Default: no scope restrictions
            getFeatures: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApiKeyService,
                {
                    provide: ApiKeyCollection,
                    useValue: mockApiKeyCollection,
                },
                {
                    provide: AuthorizationService,
                    useValue: mockAuthorizationService,
                },
                {
                    provide: OrganizationCollection,
                    useValue: mockOrganizationCollection,
                },
                {
                    provide: SecurityAuditCollection,
                    useValue: mockSecurityAuditCollection,
                },
                {
                    provide: FeatureService,
                    useValue: mockFeatureService,
                },
            ],
        }).compile();

        service = module.get<ApiKeyService>(ApiKeyService);
        apiKeyCollection = module.get(ApiKeyCollection);
        authorizationService = module.get(AuthorizationService);
        securityAuditCollection = module.get(SecurityAuditCollection);
        featureService = module.get(FeatureService);
        organizationCollection = module.get(OrganizationCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore Logger methods after all tests
        jest.restoreAllMocks();
    });

    describe('createApiKey', () => {
        it('throws BadRequestException when principal is not an Account (ensuring only accounts can create API keys)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };
            const auditContext = createAuditContextForPrincipal(apiKeyPrincipal);

            const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                name: faker.word.noun(),
                api_key: faker.string.alphanumeric(32),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: new ObjectId(),
            };

            await expect(service.createApiKey(params, apiKeyPrincipal, auditContext)).rejects.toThrow(BadRequestException);
            await expect(service.createApiKey(params, apiKeyPrincipal, auditContext)).rejects.toThrow('Only accounts can create account-scoped API keys');
        });

        describe('Scope validation', () => {
            it('throws BadRequestException when scopes array is empty (ensuring empty scope configuration prevents all API key creation)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                };

                featureService.getApiKeyScopes.mockReturnValue([]);

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(featureService.getApiKeyScopes).toHaveBeenCalled();
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized attempt to create API key with scope ${trailmixModels.ApiKeyScope.Account} which is not in the allowed scopes`,
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('allows creation when scope is in the allowed scopes list (ensuring valid scopes pass validation)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                });

                featureService.getApiKeyScopes.mockReturnValue([
                    trailmixModels.ApiKeyScope.Account,
                ]);
                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(featureService.getApiKeyScopes).toHaveBeenCalled();
                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(result).toEqual(createdApiKey);
            });

            it('throws BadRequestException and logs security audit when scope is not in the allowed scopes list (ensuring unauthorized scope attempts are blocked and audited)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                };

                featureService.getApiKeyScopes.mockReturnValue([
                    trailmixModels.ApiKeyScope.Account,
                ]);

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(featureService.getApiKeyScopes).toHaveBeenCalled();
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized attempt to create API key with scope ${trailmixModels.ApiKeyScope.Organization} which is not in the allowed scopes`,
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });
        });

        describe('Global scope', () => {
            it('creates global-scoped API key for global admin (ensuring global admins can create global-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Global,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Global
                });

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Global]);
                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(result).toEqual(createdApiKey);
            });

            it('throws BadRequestException when scope_type is Global and scope_id is provided (ensuring global-scoped keys cannot have scope_id)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Global,
                    scope_id: new ObjectId(),
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Global]);
                authorizationService.isGlobalAdmin.mockResolvedValue(true);

                await expect(service.createApiKey(params, accountPrincipal, auditContext)).rejects.toThrow(BadRequestException);
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws BadRequestException and logs security audit when non-global admin tries to create global-scoped key (ensuring only global admins can create global-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Global,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Global]);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: 'Unauthorized attempt to create global-scoped API key',
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });
        });

        describe('Account scope', () => {
            it('creates account-scoped API key when scope_id matches principal ID (ensuring users can only create keys for themselves)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                });

                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(result).toEqual(createdApiKey);
            });

            it('creates account-scoped API key for global admin (ensuring global admins can create keys for any account)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const otherAccountId = new ObjectId();
                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: otherAccountId,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: otherAccountId,
                });

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Account]);
                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
                expect(result).toEqual(createdApiKey);
            });

            it('throws BadRequestException and logs security audit when scope_id does not match principal ID (ensuring users cannot create keys for other accounts)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const otherAccountId = new ObjectId();
                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: otherAccountId,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Account]);

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: 'Unauthorized attempt to create account-scoped API key for another principal',
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws BadRequestException when scope_id is missing (ensuring account-scoped keys require scope_id)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Account,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Account]);

                await expect(service.createApiKey(params, accountPrincipal, auditContext)).rejects.toThrow(BadRequestException);
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });
        });

        describe('Organization scope', () => {
            it('successfully creates organization-scoped API key when user is a global admin (ensuring global admins can create org-scoped keys without organization role)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                });

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(authorizationService.resolveOrganizationAuthorization).not.toHaveBeenCalled();
                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(result).toEqual(createdApiKey);
            });

            it('creates organization-scoped API key when user has admin/owner role (ensuring only org admins/owners can create org-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };
                const createdApiKey = TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                });

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
                const adminRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationEntity._id,
                    role: trailmixModels.RoleValue.Admin,
                });
                authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                    hasAccess: true,
                    isGlobalAdmin: false,
                    globalRoles: [],
                    organizationRoles: [adminRole],
                });
                apiKeyCollection.create.mockResolvedValue(createdApiKey);

                const result = await service.createApiKey(params, accountPrincipal, auditContext);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                    principal: accountPrincipal,
                    rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: organizationEntity._id,
                });
                expect(apiKeyCollection.create).toHaveBeenCalledWith(params, auditContext);
                expect(result).toEqual(createdApiKey);
            });

            it('throws BadRequestException when organizations feature is not enabled (ensuring org-scoped keys require organizations feature)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(false);

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);
                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws BadRequestException when scope_id is missing (ensuring organization-scoped keys require scope_id)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);

                const params: Partial<Utils.Creatable<trailmixModels.ApiKey.Entity>> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);

                await expect(
                    service.createApiKey(params as Utils.Creatable<trailmixModels.ApiKey.Entity>, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws BadRequestException and logs security audit when user lacks required role (ensuring unauthorized org key creation attempts are blocked and audited)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
                authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                    hasAccess: false,
                    isGlobalAdmin: false,
                    globalRoles: [],
                    organizationRoles: [],
                });

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(BadRequestException);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized attempt to create organization-scoped API key for organization ${organizationEntity._id}`,
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws ForbiddenException when user has User role but not Admin/Owner (ensuring insufficient permissions throw ForbiddenException)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
                const userRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationEntity._id,
                    role: trailmixModels.RoleValue.User,
                });
                authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                    hasAccess: false,
                    isGlobalAdmin: false,
                    globalRoles: [],
                    organizationRoles: [userRole],
                });

                await expect(
                    service.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(ForbiddenException);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized attempt to create organization-scoped API key for organization ${organizationEntity._id}`,
                    source: ApiKeyService.name,
                });
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });

            it('throws InternalServerErrorException when organizations feature is enabled but organizationCollection is not available (unexpected situation)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const auditContext = createAuditContextForPrincipal(accountPrincipal);
                const organizationEntity = TestUtils.Entities.createOrganization();

                const params: Utils.Creatable<trailmixModels.ApiKey.Entity> = {
                    name: faker.word.noun(),
                    api_key: faker.string.alphanumeric(32),
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };

                // Create a new test module without OrganizationCollection provider
                const testModuleWithoutOrgCollection: TestingModule = await Test.createTestingModule({
                    providers: [
                        ApiKeyService,
                        {
                            provide: ApiKeyCollection,
                            useValue: apiKeyCollection,
                        },
                        {
                            provide: AuthorizationService,
                            useValue: authorizationService,
                        },
                        {
                            provide: SecurityAuditCollection,
                            useValue: securityAuditCollection,
                        },
                        {
                            provide: FeatureService,
                            useValue: featureService,
                        },
                        // OrganizationCollection is not provided - simulating undefined
                    ],
                }).compile();

                const serviceWithoutOrgCollection = testModuleWithoutOrgCollection.get<ApiKeyService>(ApiKeyService);

                featureService.getApiKeyScopes.mockReturnValue([trailmixModels.ApiKeyScope.Organization]);
                featureService.isOrganizationsEnabled.mockReturnValue(true);

                await expect(
                    serviceWithoutOrgCollection.createApiKey(params, accountPrincipal, auditContext)
                ).rejects.toThrow(InternalServerErrorException);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(Logger.prototype.error).toHaveBeenCalledWith('Organization collections and services are not available despite organizations feature being enabled');
                expect(apiKeyCollection.create).not.toHaveBeenCalled();
            });
        });

        it('throws InternalServerErrorException for invalid scope type (unexpected edge case)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.Account,
                entity: accountEntity,
            };
            const auditContext = createAuditContextForPrincipal(accountPrincipal);

            const invalidScopeType = 'invalid' as any;

            const params = {
                name: faker.word.noun(),
                api_key: faker.string.alphanumeric(32),
                scope_type: invalidScopeType,
            };


            featureService.getApiKeyScopes.mockReturnValue([invalidScopeType]);

            await expect(
                service.createApiKey(params as Utils.Creatable<trailmixModels.ApiKey.Entity>, accountPrincipal, auditContext)
            ).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getApiKeys', () => {
        it('returns empty results for ApiKey principal with Account scope (ensuring ApiKey principals can query but get filtered results)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };

            const queryParams: GetApiKeysParams = {
                scope_type: trailmixModels.ApiKeyScope.Account,
            };

            authorizationService.isGlobalAdmin.mockResolvedValue(false);
            apiKeyCollection.find.mockResolvedValue([]);

            const result = await service.getApiKeys(apiKeyPrincipal, queryParams);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                apiKeyEntity._id,
                trailmixModels.Principal.ApiKey
            );
            expect(apiKeyCollection.find).toHaveBeenCalledWith({
                "scope.type": trailmixModels.ApiKeyScope.Account,
                "scope.id": apiKeyEntity._id,
            });
            expect(result).toEqual({ items: [], count: 0 });
        });

        describe('Global admin', () => {
            it('returns all API keys for global admin without filters (ensuring global admins can see all keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams: GetApiKeysParams = {};
                const mockApiKeys = [TestUtils.Entities.createApiKey()];

                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.find.mockResolvedValue(mockApiKeys);

                const result = await service.getApiKeys(accountPrincipal, queryParams);

                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(apiKeyCollection.find).toHaveBeenCalledWith({});
                expect(result).toEqual({
                    items: mockApiKeys,
                    count: 1,
                });
            });

            it('returns filtered API keys for global admin with name filter (ensuring global admins can filter by name)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const searchName = faker.word.noun();
                const queryParams: GetApiKeysParams = {
                    name: searchName,
                };
                const mockApiKeys = [TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                    name: searchName,
                })];

                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.find.mockResolvedValue(mockApiKeys);

                const result = await service.getApiKeys(accountPrincipal, queryParams);

                expect(apiKeyCollection.find).toHaveBeenCalledWith({
                    name: searchName,
                });
                expect(result).toEqual({
                    items: mockApiKeys,
                    count: 1,
                });
            });

            it('returns filtered API keys for global admin with multiple filters (ensuring global admins can combine multiple filters)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const searchName = faker.word.noun();
                const queryParams: GetApiKeysParams = {
                    name: searchName,
                    disabled: false,
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                };
                const mockApiKeys = [TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                    name: searchName,
                })];

                authorizationService.isGlobalAdmin.mockResolvedValue(true);
                apiKeyCollection.find.mockResolvedValue(mockApiKeys);

                const result = await service.getApiKeys(accountPrincipal, queryParams);

                expect(apiKeyCollection.find).toHaveBeenCalledWith({
                    name: searchName,
                    'scope.type': trailmixModels.ApiKeyScope.Account,
                    'scope.id': accountEntity._id,
                });
                expect(result).toEqual({
                    items: mockApiKeys,
                    count: 1,
                });
            });
        });

        describe('Non-global admin', () => {
            beforeEach(() => {
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
            });

            it('throws BadRequestException when scope_type is missing (ensuring non-global admins must specify scope type)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams: GetApiKeysParams = {};

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(BadRequestException);
            });

            it('throws BadRequestException and logs security audit when trying to get global-scoped keys (ensuring non-global admins cannot access global-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Global,
                };

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(BadRequestException);

                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: 'Unauthorized attempt to get global-scoped API keys for non-global admins',
                    source: ApiKeyService.name,
                });
            });

            it('returns account-scoped API keys for the principal (ensuring users can only see their own account-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const searchName = faker.word.noun();
                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    name: searchName,
                };
                const mockApiKeys = [TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Account,
                    scope_id: accountEntity._id,
                    name: searchName,
                })];

                apiKeyCollection.find.mockResolvedValue(mockApiKeys);

                const result = await service.getApiKeys(accountPrincipal, queryParams);

                expect(apiKeyCollection.find).toHaveBeenCalledWith({
                    name: searchName,
                    'scope.type': trailmixModels.ApiKeyScope.Account,
                    'scope.id': accountEntity._id,
                });
                expect(result).toEqual({
                    items: mockApiKeys,
                    count: 1,
                });
            });

            it('returns organization-scoped API keys when scope_id is provided and user has admin/owner role (ensuring only org admins/owners can query org-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const organizationEntity = TestUtils.Entities.createOrganization();

                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                    disabled: true,
                };
                const mockApiKeys = [TestUtils.Entities.createApiKey({
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                })];
                const adminRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationEntity._id,
                    role: trailmixModels.RoleValue.Admin,
                });

                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
                authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                    hasAccess: true,
                    isGlobalAdmin: false,
                    globalRoles: [],
                    organizationRoles: [adminRole],
                });
                apiKeyCollection.find.mockResolvedValue(mockApiKeys);

                const result = await service.getApiKeys(accountPrincipal, queryParams);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                    principal: accountPrincipal,
                    rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: organizationEntity._id,
                });
                expect(apiKeyCollection.find).toHaveBeenCalledWith({
                    disabled: true,
                    'scope.type': trailmixModels.ApiKeyScope.Organization,
                    'scope.id': organizationEntity._id,
                });
                expect(result).toEqual({
                    items: mockApiKeys,
                    count: 1,
                });
            });

            it('throws BadRequestException when organizations feature is not enabled for organization scope (ensuring org-scoped queries require organizations feature)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                };

                featureService.isOrganizationsEnabled.mockReturnValue(false);

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(BadRequestException);
                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
            });

            it('throws ForbiddenException when user does not have admin/owner role for organization scope (ensuring only org admins/owners can query org-scoped keys)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };
                const organizationEntity = TestUtils.Entities.createOrganization();

                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                    scope_id: organizationEntity._id,
                };
                const userRole = TestUtils.Models.createOrganizationRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    organization_id: organizationEntity._id,
                    role: trailmixModels.RoleValue.User,
                });

                featureService.isOrganizationsEnabled.mockReturnValue(true);
                authorizationService.isGlobalAdmin.mockResolvedValue(false);
                authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                    hasAccess: false,
                    isGlobalAdmin: false,
                    globalRoles: [],
                    organizationRoles: [userRole],
                });

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(ForbiddenException);

                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
                expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                    accountEntity._id,
                    trailmixModels.Principal.Account
                );
                expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                    principal: accountPrincipal,
                    rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                    principalTypeAllowList: [trailmixModels.Principal.Account],
                    organizationId: organizationEntity._id,
                });
                expect(apiKeyCollection.find).not.toHaveBeenCalled();
            });

            it('throws BadRequestException when scope_id is missing for organization scope (ensuring org-scoped queries require scope_id)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams: GetApiKeysParams = {
                    scope_type: trailmixModels.ApiKeyScope.Organization,
                };

                featureService.isOrganizationsEnabled.mockReturnValue(true);

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(BadRequestException);
                expect(featureService.isOrganizationsEnabled).toHaveBeenCalled();
            });

            it('throws InternalServerErrorException for invalid scope type (unexpected edge case)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const accountPrincipal: RequestPrincipal = {
                    principal_type: trailmixModels.Principal.Account,
                    entity: accountEntity,
                };

                const queryParams = {
                    scope_type: 'invalid' as any,
                };

                await expect(
                    service.getApiKeys(accountPrincipal, queryParams)
                ).rejects.toThrow(InternalServerErrorException);
            });
        });
    });

    describe('getApiKey', () => {
        it('returns API key when principal has access (ensuring authorized principals can retrieve API keys)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.Account,
                entity: accountEntity,
            };
            const apiKeyEntity = TestUtils.Entities.createApiKey();

            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(true);

            const result = await service.getApiKey(apiKeyEntity, accountPrincipal);

            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                accountPrincipal,
                apiKeyEntity.scope_type,
                apiKeyEntity.scope_id
            );
            expect(result).toEqual(apiKeyEntity);
        });

        it('throws NotFoundException when ApiKey principal does not have access (ensuring unauthorized access attempts return not found)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };
            const testApiKey = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: new ObjectId(), // Different ID, so access will be denied
            });

            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(false);

            await expect(
                service.getApiKey(testApiKey, apiKeyPrincipal)
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.getApiKey(testApiKey, apiKeyPrincipal)
            ).rejects.toThrow('API key not found');
            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                apiKeyPrincipal,
                testApiKey.scope_type,
                testApiKey.scope_id
            );
        });

        it('throws NotFoundException when Account principal does not have access (ensuring unauthorized access attempts return not found)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.Account,
                entity: accountEntity,
            };
            const apiKeyEntity = TestUtils.Entities.createApiKey();

            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(false);

            await expect(
                service.getApiKey(apiKeyEntity, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                accountPrincipal,
                apiKeyEntity.scope_type,
                apiKeyEntity.scope_id
            );
        });
    });

    describe('deleteApiKey', () => {
        it('deletes API key when principal has access (ensuring authorized principals can delete API keys)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.Account,
                entity: accountEntity,
            };
            const auditContext = createAuditContextForPrincipal(accountPrincipal);
            const apiKeyEntity = TestUtils.Entities.createApiKey();

            const deleteResult = { acknowledged: true, deletedCount: 1 };
            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(true);
            apiKeyCollection.deleteOne.mockResolvedValue(deleteResult as any);

            await service.deleteApiKey(apiKeyEntity, accountPrincipal, auditContext);

            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                accountPrincipal,
                apiKeyEntity.scope_type,
                apiKeyEntity.scope_id
            );
            expect(apiKeyCollection.deleteOne).toHaveBeenCalledWith(apiKeyEntity._id, auditContext);
        });

        it('throws NotFoundException when ApiKey principal does not have access (ensuring unauthorized access attempts return not found)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const apiKeyPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.ApiKey,
                entity: apiKeyEntity,
            };
            const auditContext = createAuditContextForPrincipal(apiKeyPrincipal);
            const testApiKey = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: new ObjectId(), // Different ID, so access will be denied
            });

            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(false);

            await expect(
                service.deleteApiKey(testApiKey, apiKeyPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);
            await expect(
                service.deleteApiKey(testApiKey, apiKeyPrincipal, auditContext)
            ).rejects.toThrow('API key not found');
            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                apiKeyPrincipal,
                testApiKey.scope_type,
                testApiKey.scope_id
            );
            expect(apiKeyCollection.deleteOne).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when Account principal does not have access (ensuring unauthorized deletion attempts return not found)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                principal_type: trailmixModels.Principal.Account,
                entity: accountEntity,
            };
            const auditContext = createAuditContextForPrincipal(accountPrincipal);
            const apiKeyEntity = TestUtils.Entities.createApiKey();

            authorizationService.authorizeApiKeyAccessForPrincipal.mockResolvedValue(false);

            await expect(
                service.deleteApiKey(apiKeyEntity, accountPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.authorizeApiKeyAccessForPrincipal).toHaveBeenCalledWith(
                accountPrincipal,
                apiKeyEntity.scope_type,
                apiKeyEntity.scope_id
            );
            expect(apiKeyCollection.deleteOne).not.toHaveBeenCalled();
        });
    });
});
