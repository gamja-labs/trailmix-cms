import { Test, TestingModule } from '@nestjs/testing';
import { Logger, InternalServerErrorException, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAuth } from '@clerk/fastify';

import * as trailmixModels from '@trailmix-cms/models';

import { AuthService, AuthResult, GlobalRoleService } from '@/services';
import { AccountService } from '@/services/account.service';
import { AccountCollection, ApiKeyCollection, SecurityAuditCollection } from '@/collections';
import { PROVIDER_SYMBOLS } from '@/constants';
import { type RequestPrincipal } from '@/types';

import * as TestUtils from '../../utils';

// Mock @clerk/fastify
jest.mock('@clerk/fastify', () => ({
    getAuth: jest.fn(),
}));

describe('AuthService', () => {
    let service: AuthService;
    let accountService: jest.Mocked<AccountService>;
    let accountCollection: jest.Mocked<AccountCollection>;
    let globalRoleService: jest.Mocked<GlobalRoleService>;
    let securityAuditCollection: jest.Mocked<SecurityAuditCollection>;
    let apiKeyCollection: jest.Mocked<ApiKeyCollection>;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockAccountService = {
            getAccount: jest.fn(),
            upsertAccount: jest.fn(),
        };

        const mockAccountCollection = {
            findOne: jest.fn(),
        };

        const mockGlobalRoleService = {
            find: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const mockApiKeyCollection = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: AccountService,
                    useValue: mockAccountService,
                },
                {
                    provide: AccountCollection,
                    useValue: mockAccountCollection,
                },
                {
                    provide: GlobalRoleService,
                    useValue: mockGlobalRoleService,
                },
                {
                    provide: SecurityAuditCollection,
                    useValue: mockSecurityAuditCollection,
                },
                {
                    provide: ApiKeyCollection,
                    useValue: mockApiKeyCollection,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        accountService = module.get(AccountService);
        accountCollection = module.get(AccountCollection);
        globalRoleService = module.get(GlobalRoleService);
        securityAuditCollection = module.get(SecurityAuditCollection);
        apiKeyCollection = module.get(ApiKeyCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('validateAuth', () => {
        const requestUrl = '/test/endpoint';
        const accountEntity = TestUtils.Entities.createAccount();
        const accountPrincipal: RequestPrincipal = {
            entity: accountEntity,
            principal_type: trailmixModels.Principal.Account,
        };

        describe('null principal', () => {
            it('returns IsValid when allowAnonymous is true (ensuring anonymous access is allowed)', async () => {
                const result = await service.validateAuth(
                    null,
                    {
                        allowAnonymous: true,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns Unauthorized when allowAnonymous is false (ensuring anonymous access is blocked)', async () => {
                const result = await service.validateAuth(
                    null,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Unauthorized);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });
        });

        describe('principal type validation', () => {
            it('returns IsValid when principal type matches required type (ensuring matching principal types pass)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [trailmixModels.Principal.Account],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns Forbidden when principal type does not match required type (ensuring non-matching principal types are rejected)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [trailmixModels.Principal.ApiKey],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Forbidden);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized access to ${requestUrl}, required principal type not found: ${trailmixModels.Principal.ApiKey}`,
                    source: AuthService.name,
                });
            });

            it('returns IsValid when no principal types are required (ensuring any principal type passes when none required)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });
        });

        describe('API key scope validation', () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Account,
            });
            const apiKeyPrincipal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };

            it('returns IsValid when API key scope matches required scope (ensuring matching API key scopes pass)', async () => {
                const result = await service.validateAuth(
                    apiKeyPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Account],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns Forbidden when API key scope does not match required scope (ensuring non-matching API key scopes are rejected)', async () => {
                const result = await service.validateAuth(
                    apiKeyPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Organization],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Forbidden);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: apiKeyEntity._id,
                    principal_type: trailmixModels.Principal.ApiKey,
                    message: `Unauthorized access to ${requestUrl}, required API key scope is not allowed:${trailmixModels.ApiKeyScope.Organization}`,
                    source: AuthService.name,
                });
            });

            it('returns IsValid when no API key scopes are required (ensuring any API key scope passes when none required)', async () => {
                const result = await service.validateAuth(
                    apiKeyPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns IsValid when API key has one of multiple required scopes (ensuring any matching scope passes)', async () => {
                const result = await service.validateAuth(
                    apiKeyPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Organization, trailmixModels.ApiKeyScope.Account],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('does not check API key scopes for account principals (ensuring scope check only applies to API keys)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Account],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });
        });

        describe('role validation', () => {
            it('returns IsValid when no roles are required (ensuring authenticated principals pass when no roles required)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(globalRoleService.find).not.toHaveBeenCalled();
            });

            it('returns Forbidden when no global role assignments exist (ensuring null role assignments are rejected and audited)', async () => {
                globalRoleService.find.mockResolvedValue(null as any);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Forbidden);
                expect(globalRoleService.find).toHaveBeenCalledWith({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                });
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized access to ${requestUrl}, no global role assignments found`,
                    source: AuthService.name,
                });
            });

            it('returns Forbidden when global role assignments is empty array (ensuring empty role assignments are rejected)', async () => {
                globalRoleService.find.mockResolvedValue([]);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Forbidden);
                expect(securityAuditCollection.insertOne).toHaveBeenCalled();
            });

            it('returns IsValid when principal has matching required role (ensuring matching roles pass)', async () => {
                const userRole = TestUtils.Models.createGlobalRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    role: trailmixModels.RoleValue.User,
                });
                globalRoleService.find.mockResolvedValue([userRole]);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(globalRoleService.find).toHaveBeenCalledWith({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                });
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns IsValid when principal has Admin role even if not in required roles (ensuring Admin role grants access)', async () => {
                const adminRole = TestUtils.Models.createGlobalRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    role: trailmixModels.RoleValue.Admin,
                });
                globalRoleService.find.mockResolvedValue([adminRole]);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
            });

            it('returns IsValid when principal has one of multiple required roles (ensuring any matching role passes)', async () => {
                const userRole = TestUtils.Models.createGlobalRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    role: trailmixModels.RoleValue.User,
                });
                globalRoleService.find.mockResolvedValue([userRole]);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
            });

            it('returns Forbidden when principal does not have required role (ensuring non-matching roles are rejected)', async () => {
                const readerRole = TestUtils.Models.createGlobalRoleModel({
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    role: trailmixModels.RoleValue.Reader,
                });
                globalRoleService.find.mockResolvedValue([readerRole]);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.Forbidden);
                expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                    event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                    principal_id: accountEntity._id,
                    principal_type: trailmixModels.Principal.Account,
                    message: `Unauthorized access to ${requestUrl}, required role not found: ${trailmixModels.RoleValue.User}`,
                    source: AuthService.name,
                });
            });

            it('returns IsValid when principal has multiple roles including required one (ensuring role matching works with multiple roles)', async () => {
                const roles = [
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: accountEntity._id,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.Reader,
                    }),
                    TestUtils.Models.createGlobalRoleModel({
                        principal_id: accountEntity._id,
                        principal_type: trailmixModels.Principal.Account,
                        role: trailmixModels.RoleValue.User,
                    }),
                ];
                globalRoleService.find.mockResolvedValue(roles);

                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: false,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
            });
        });

        describe('allowAnonymous with principal', () => {
            it('returns IsValid when allowAnonymous is true even with principal (ensuring anonymous flag allows authenticated principals)', async () => {
                const result = await service.validateAuth(
                    accountPrincipal,
                    {
                        allowAnonymous: true,
                        requiredPrincipalTypes: [],
                        requiredGlobalRoles: [trailmixModels.RoleValue.User],
                        requiredApiKeyScopes: [],
                    },
                    requestUrl
                );

                expect(result).toBe(AuthResult.IsValid);
                expect(globalRoleService.find).not.toHaveBeenCalled();
            });
        });
    });

    describe('getPrincipal', () => {
        const createMockContext = (request: Partial<FastifyRequest>): ExecutionContext => {
            return {
                switchToHttp: () => ({
                    getRequest: () => request as FastifyRequest,
                }),
            } as ExecutionContext;
        };

        describe('API key priority', () => {
            it('returns API key principal when API key exists (ensuring API key takes priority over account)', async () => {
                const apiKeyEntity = TestUtils.Entities.createApiKey();
                const request = {
                    headers: {
                        [trailmixModels.API_KEY_HEADER]: apiKeyEntity.api_key,
                    },
                };
                const context = createMockContext(request);

                apiKeyCollection.findOne.mockResolvedValue(apiKeyEntity);

                const result = await service.getPrincipal(context);

                expect(result).toEqual({
                    entity: apiKeyEntity,
                    principal_type: trailmixModels.Principal.ApiKey,
                });
                expect(apiKeyCollection.findOne).toHaveBeenCalledWith({ api_key: apiKeyEntity.api_key });
                expect(accountService.getAccount).not.toHaveBeenCalled();
            });
        });

        describe('account principal', () => {
            it('returns account principal when account exists (ensuring existing accounts are returned)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const userId = 'user-123';
                const request = {
                    headers: {},
                };
                const context = createMockContext(request);

                (getAuth as jest.Mock).mockReturnValue({ userId });
                accountService.getAccount.mockResolvedValue(accountEntity);
                apiKeyCollection.findOne.mockResolvedValue(null);

                const result = await service.getPrincipal(context);

                expect(result).toEqual({
                    entity: accountEntity,
                    principal_type: trailmixModels.Principal.Account,
                });
                expect(accountService.getAccount).toHaveBeenCalledWith(userId);
                expect(accountService.upsertAccount).not.toHaveBeenCalled();
            });

            it('returns account principal after creating new account (ensuring new accounts are created and returned)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const userId = 'user-123';
                const request = {
                    headers: {},
                };
                const context = createMockContext(request);

                (getAuth as jest.Mock).mockReturnValue({ userId });
                accountService.getAccount.mockResolvedValue(null);
                accountService.upsertAccount.mockResolvedValue(accountEntity);
                apiKeyCollection.findOne.mockResolvedValue(null);

                const result = await service.getPrincipal(context);

                expect(result).toEqual({
                    entity: accountEntity,
                    principal_type: trailmixModels.Principal.Account,
                });
                expect(accountService.getAccount).toHaveBeenCalledWith(userId);
                expect(accountService.upsertAccount).toHaveBeenCalledWith(userId);
            });

            it('does not call auth guard hook when hook is not provided (ensuring optional hook does not break flow)', async () => {
                const accountEntity = TestUtils.Entities.createAccount();
                const userId = 'user-123';
                const request = {
                    headers: {},
                };
                const context = createMockContext(request);

                (getAuth as jest.Mock).mockReturnValue({ userId });
                accountService.getAccount.mockResolvedValue(null);
                accountService.upsertAccount.mockResolvedValue(accountEntity);
                apiKeyCollection.findOne.mockResolvedValue(null);

                const result = await service.getPrincipal(context);

                expect(result).not.toBeNull();
                expect(result?.principal_type).toBe(trailmixModels.Principal.Account);
                // Hook is not provided in default setup, so it should not be called
            });

            it('returns null when no userId and no API key (ensuring missing credentials return null)', async () => {
                const request = {
                    headers: {},
                };
                const context = createMockContext(request);

                (getAuth as jest.Mock).mockReturnValue({ userId: null });
                apiKeyCollection.findOne.mockResolvedValue(null);

                const result = await service.getPrincipal(context);

                expect(result).toBeNull();
                expect(accountService.getAccount).not.toHaveBeenCalled();
            });
        });
    });

    describe('getApiKey (via getPrincipal)', () => {
        const createMockContext = (request: Partial<FastifyRequest>): ExecutionContext => {
            return {
                switchToHttp: () => ({
                    getRequest: () => request as FastifyRequest,
                }),
            } as ExecutionContext;
        };

        it('returns null when apiKeyCollection is not provided (ensuring missing collection returns null)', async () => {
            const moduleWithoutApiKey: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: AccountService,
                        useValue: { getAccount: jest.fn(), upsertAccount: jest.fn() },
                    },
                    {
                        provide: AccountCollection,
                        useValue: { findOne: jest.fn() },
                    },
                    {
                        provide: GlobalRoleService,
                        useValue: { find: jest.fn() },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: { insertOne: jest.fn() },
                    },
                ],
            }).compile();

            const serviceWithoutApiKey = moduleWithoutApiKey.get<AuthService>(AuthService);
            const request = { headers: {} };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId: null });

            const result = await serviceWithoutApiKey.getPrincipal(context);

            expect(result).toBeNull();
        });

        it('returns null when API key header is missing (ensuring missing header returns null)', async () => {
            const request = {
                headers: {},
            };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId: null });

            const result = await service.getPrincipal(context);

            expect(result).toBeNull();
            expect(apiKeyCollection.findOne).not.toHaveBeenCalled();
        });

        it('returns null when API key not found (ensuring non-existent API keys return null)', async () => {
            const apiKey = 'test-api-key';
            const request = {
                headers: {
                    [trailmixModels.API_KEY_HEADER]: apiKey,
                },
            };
            const context = createMockContext(request);

            apiKeyCollection.findOne.mockResolvedValue(null);
            (getAuth as jest.Mock).mockReturnValue({ userId: null });

            const result = await service.getPrincipal(context);

            expect(result).toBeNull();
            expect(apiKeyCollection.findOne).toHaveBeenCalledWith({ api_key: apiKey });
        });

        it('returns null when API key is disabled (ensuring disabled API keys return null)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey({ disabled: true });
            const request = {
                headers: {
                    [trailmixModels.API_KEY_HEADER]: apiKeyEntity.api_key,
                },
            };
            const context = createMockContext(request);

            apiKeyCollection.findOne.mockResolvedValue(apiKeyEntity);
            (getAuth as jest.Mock).mockReturnValue({ userId: null });

            const result = await service.getPrincipal(context);

            expect(result).toBeNull();
        });

        it('returns API key entity when valid (ensuring valid API keys are returned)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey({ disabled: false });
            const request = {
                headers: {
                    [trailmixModels.API_KEY_HEADER]: apiKeyEntity.api_key,
                },
            };
            const context = createMockContext(request);

            apiKeyCollection.findOne.mockResolvedValue(apiKeyEntity);

            const result = await service.getPrincipal(context);

            expect(result).toEqual({
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            });
        });
    });

    describe('auth guard hook', () => {
        const createMockContext = (request: Partial<FastifyRequest>): ExecutionContext => {
            return {
                switchToHttp: () => ({
                    getRequest: () => request as FastifyRequest,
                }),
            } as ExecutionContext;
        };

        it('calls auth guard hook when creating new account (ensuring hook is called for new accounts)', async () => {
            const mockAuthGuardHook = {
                onHook: jest.fn().mockResolvedValue(true),
            };

            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: AccountService,
                        useValue: {
                            getAccount: jest.fn().mockResolvedValue(null),
                            upsertAccount: jest.fn().mockResolvedValue(TestUtils.Entities.createAccount()),
                        },
                    },
                    {
                        provide: AccountCollection,
                        useValue: { findOne: jest.fn() },
                    },
                    {
                        provide: GlobalRoleService,
                        useValue: { find: jest.fn() },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: { insertOne: jest.fn() },
                    },
                    {
                        provide: ApiKeyCollection,
                        useValue: { findOne: jest.fn().mockResolvedValue(null) },
                    },
                    {
                        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
                        useValue: mockAuthGuardHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<AuthService>(AuthService);
            const accountEntity = TestUtils.Entities.createAccount();
            const userId = 'user-123';
            const request = { headers: {} };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId });
            const accountServiceWithHook = moduleWithHook.get<AccountService>(AccountService);
            (accountServiceWithHook.getAccount as jest.Mock).mockResolvedValue(null);
            (accountServiceWithHook.upsertAccount as jest.Mock).mockResolvedValue(accountEntity);

            await serviceWithHook.getPrincipal(context);

            expect(mockAuthGuardHook.onHook).toHaveBeenCalledWith(accountEntity);
            expect(mockAuthGuardHook.onHook).toHaveBeenCalledTimes(1);
        });

        it('does not call auth guard hook when account already exists (ensuring hook is only called for new accounts)', async () => {
            const mockAuthGuardHook = {
                onHook: jest.fn().mockResolvedValue(true),
            };

            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: AccountService,
                        useValue: {
                            getAccount: jest.fn().mockResolvedValue(TestUtils.Entities.createAccount()),
                            upsertAccount: jest.fn(),
                        },
                    },
                    {
                        provide: AccountCollection,
                        useValue: { findOne: jest.fn() },
                    },
                    {
                        provide: GlobalRoleService,
                        useValue: { find: jest.fn() },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: { insertOne: jest.fn() },
                    },
                    {
                        provide: ApiKeyCollection,
                        useValue: { findOne: jest.fn().mockResolvedValue(null) },
                    },
                    {
                        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
                        useValue: mockAuthGuardHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<AuthService>(AuthService);
            const userId = 'user-123';
            const request = { headers: {} };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId });

            await serviceWithHook.getPrincipal(context);

            expect(mockAuthGuardHook.onHook).not.toHaveBeenCalled();
        });

        it('throws InternalServerErrorException when auth guard hook returns false (ensuring hook rejection throws error)', async () => {
            const mockAuthGuardHook = {
                onHook: jest.fn().mockResolvedValue(false),
            };

            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: AccountService,
                        useValue: {
                            getAccount: jest.fn().mockResolvedValue(null),
                            upsertAccount: jest.fn().mockResolvedValue(TestUtils.Entities.createAccount()),
                        },
                    },
                    {
                        provide: AccountCollection,
                        useValue: { findOne: jest.fn() },
                    },
                    {
                        provide: GlobalRoleService,
                        useValue: { find: jest.fn() },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: { insertOne: jest.fn() },
                    },
                    {
                        provide: ApiKeyCollection,
                        useValue: { findOne: jest.fn().mockResolvedValue(null) },
                    },
                    {
                        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
                        useValue: mockAuthGuardHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<AuthService>(AuthService);
            const accountEntity = TestUtils.Entities.createAccount();
            const userId = 'user-123';
            const request = { headers: {} };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId });
            const accountServiceWithHook = moduleWithHook.get<AccountService>(AccountService);
            (accountServiceWithHook.getAccount as jest.Mock).mockResolvedValue(null);
            (accountServiceWithHook.upsertAccount as jest.Mock).mockResolvedValue(accountEntity);

            await expect(serviceWithHook.getPrincipal(context)).rejects.toThrow('Failed to validate account using auth guard hook');
            expect(mockAuthGuardHook.onHook).toHaveBeenCalledWith(accountEntity);
        });

        it('allows account creation to proceed when auth guard hook returns true (ensuring hook approval allows flow)', async () => {
            const mockAuthGuardHook = {
                onHook: jest.fn().mockResolvedValue(true),
            };

            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: AccountService,
                        useValue: {
                            getAccount: jest.fn().mockResolvedValue(null),
                            upsertAccount: jest.fn().mockResolvedValue(TestUtils.Entities.createAccount()),
                        },
                    },
                    {
                        provide: AccountCollection,
                        useValue: { findOne: jest.fn() },
                    },
                    {
                        provide: GlobalRoleService,
                        useValue: { find: jest.fn() },
                    },
                    {
                        provide: SecurityAuditCollection,
                        useValue: { insertOne: jest.fn() },
                    },
                    {
                        provide: ApiKeyCollection,
                        useValue: { findOne: jest.fn().mockResolvedValue(null) },
                    },
                    {
                        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
                        useValue: mockAuthGuardHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<AuthService>(AuthService);
            const accountEntity = TestUtils.Entities.createAccount();
            const userId = 'user-123';
            const request = { headers: {} };
            const context = createMockContext(request);

            (getAuth as jest.Mock).mockReturnValue({ userId });
            const accountServiceWithHook = moduleWithHook.get<AccountService>(AccountService);
            (accountServiceWithHook.getAccount as jest.Mock).mockResolvedValue(null);
            (accountServiceWithHook.upsertAccount as jest.Mock).mockResolvedValue(accountEntity);

            const result = await serviceWithHook.getPrincipal(context);

            expect(result).not.toBeNull();
            expect(result?.principal_type).toBe(trailmixModels.Principal.Account);
            expect(result?.entity).toEqual(accountEntity);
            expect(mockAuthGuardHook.onHook).toHaveBeenCalledWith(accountEntity);
        });
    });

    describe('getAccountFromPrincipal', () => {
        it('returns account entity when principal type is Account (ensuring account principals return account directly)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const accountPrincipal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };

            const result = await service.getAccountFromPrincipal(accountPrincipal);

            expect(result).toEqual(accountEntity);
            expect(accountCollection.findOne).not.toHaveBeenCalled();
        });

        it('returns account when principal is account-scoped API key (ensuring account-scoped API keys resolve to account)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const apiKeyEntity = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            });
            const apiKeyPrincipal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };

            accountCollection.findOne.mockResolvedValue(accountEntity);

            const result = await service.getAccountFromPrincipal(apiKeyPrincipal);

            expect(result).toEqual(accountEntity);
            expect(accountCollection.findOne).toHaveBeenCalledWith({ _id: accountEntity._id });
        });

        it('throws error when API key is not account-scoped (ensuring non-account-scoped API keys are rejected)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Global,
            });
            const apiKeyPrincipal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };

            await expect(service.getAccountFromPrincipal(apiKeyPrincipal)).rejects.toThrow('API key is not account-scoped');
            expect(accountCollection.findOne).not.toHaveBeenCalled();
        });

        it('throws error when account-scoped API key references non-existent account (ensuring missing accounts are rejected)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const apiKeyEntity = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            });
            const apiKeyPrincipal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };

            accountCollection.findOne.mockResolvedValue(null);

            await expect(service.getAccountFromPrincipal(apiKeyPrincipal)).rejects.toThrow('Account not found');
            expect(accountCollection.findOne).toHaveBeenCalledWith({ _id: accountEntity._id });
        });

        it('throws error when API key has Organization scope (ensuring organization-scoped API keys are rejected)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey({
                scope_type: trailmixModels.ApiKeyScope.Organization,
                scope_id: TestUtils.Entities.createAccount()._id,
            });
            const apiKeyPrincipal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };

            await expect(service.getAccountFromPrincipal(apiKeyPrincipal)).rejects.toThrow('API key is not account-scoped');
            expect(accountCollection.findOne).not.toHaveBeenCalled();
        });
    });
});
