import { Test, TestingModule } from '@nestjs/testing';
import { Collection } from 'mongodb';
import { z } from 'zod';
import * as models from '@trailmix-cms/models';
import { PROVIDER_SYMBOLS } from '@/constants/provider-symbols';
import { CMSCollectionName } from '@/constants/cms-collection-names';

// Mock the database module
jest.mock('@trailmix-cms/db', () => {
    class MockBaseCollection { }
    class MockAuditedCollection extends MockBaseCollection { }

    return {
        createDatabaseProviders: jest.fn(() => [
            { provide: 'MOCK_DB_PROVIDER', useValue: 'mock' }
        ]),
        collectionFactory: jest.fn((name: string) => ({
            provide: `COLLECTION_${name}`,
            useValue: name
        })),
        BaseCollection: MockBaseCollection,
        AuditedCollection: MockAuditedCollection,
        DocumentCollection: jest.fn(() => () => { }),
        DatabaseService: class DatabaseService { },
        Collections: {
            AuditCollection: class AuditCollection { }
        }
    };
});

// Mock collections, services, managers, and controllers to avoid dependency issues
jest.mock('@/collections', () => ({
    AccountCollection: class AccountCollection { },
    OrganizationCollection: class OrganizationCollection { },
    RoleCollection: class RoleCollection { },
    SecurityAuditCollection: class SecurityAuditCollection { },
    ApiKeyCollection: class ApiKeyCollection { },
}));

jest.mock('@/services', () => ({
    FeatureService: jest.fn().mockImplementation((features) => ({
        constructor: { name: 'FeatureService' },
        features
    })),
    AccountService: class AccountService { },
    AuthService: class AuthService { },
    GlobalRoleService: class GlobalRoleService { },
    OrganizationService: class OrganizationService { },
    OrganizationRoleService: class OrganizationRoleService { },
    AuthorizationService: class AuthorizationService { },
    ApiKeyService: class ApiKeyService { },
}));

jest.mock('@/managers', () => ({
    GlobalRoleManager: class GlobalRoleManager { },
    OrganizationRoleManager: class OrganizationRoleManager { },
    OrganizationManager: class OrganizationManager { },
}));

jest.mock('@/controllers', () => {
    const AccountController = class AccountController { };
    const AuditsController = class AuditsController { };
    const GlobalRolesController = class GlobalRolesController { };
    const SecurityAuditsController = class SecurityAuditsController { };
    const OrganizationsController = class OrganizationsController { };
    const OrganizationRolesController = class OrganizationRolesController { };
    const ApiKeysController = class ApiKeysController { };

    return {
        AccountController,
        AuditsController,
        GlobalRolesController,
        SecurityAuditsController,
        OrganizationsController,
        OrganizationRolesController,
        ApiKeysController,
    };
});

import { setupTrailmixCMS, TrailmixCMSOptions } from '@/module';
import * as Collections from '@/collections';
import * as Services from '@/services';
import * as Managers from '@/managers';
import * as Controllers from '@/controllers';

describe('setupTrailmixCMS', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('default behavior (no options)', () => {
        let module: TestingModule;
        let providers: any[];
        let controllers: any[];
        beforeEach(async () => {
            jest.clearAllMocks();
            const result = setupTrailmixCMS();
            providers = result.providers;
            controllers = result.controllers;
            module = await Test.createTestingModule({
                providers,
                controllers,
            }).compile();
        });

        it('should return providers and controllers with default configuration', () => {
            expect(providers).toBeDefined();
            expect(controllers).toBeDefined();
            expect(Array.isArray(providers)).toBe(true);
            expect(Array.isArray(controllers)).toBe(true);
        });

        it('should create a valid NestJS TestingModule with default providers', () => {
            expect(module).toBeDefined();
        });

        it('should include default account providers', () => {
            const accountSchema = module.get(PROVIDER_SYMBOLS.ACCOUNT_SCHEMA);
            const accountConfig = module.get(PROVIDER_SYMBOLS.ACCOUNT_CONFIG);
            const accountMapEntity = module.get(PROVIDER_SYMBOLS.ACCOUNT_MAP_ENTITY);

            expect(accountSchema).toBe(models.Account.schema);
            expect(accountConfig).toBeDefined();
            expect(accountMapEntity).toBeDefined();
            // Account setup should not be available when not provided
            expect(() => module.get(PROVIDER_SYMBOLS.ACCOUNT_SETUP)).toThrow();
        });

        it('should not include account setup provider when not provided', () => {
            expect(() => module.get(PROVIDER_SYMBOLS.ACCOUNT_SETUP)).toThrow();
        });

        it('should use default account config when not provided', () => {
            const accountConfig = module.get(PROVIDER_SYMBOLS.ACCOUNT_CONFIG);
            expect(accountConfig).toBeDefined();
            expect(accountConfig).toEqual({ disableDefaultIndexes: false });
        });

        it('should use default account mapEntity function that returns entity as-is', () => {
            const accountMapEntity = module.get(PROVIDER_SYMBOLS.ACCOUNT_MAP_ENTITY);
            expect(accountMapEntity).toBeDefined();

            const testEntity = { _id: 'test-id', email: 'test@example.com' };
            const mapperFn = accountMapEntity as (entity: any) => any;
            expect(mapperFn(testEntity)).toBe(testEntity);
        });

        it('should include default services', () => {
            const accountService = module.get(Services.AccountService);
            const authService = module.get(Services.AuthService);
            const globalRoleService = module.get(Services.GlobalRoleService);

            expect(accountService).toBeDefined();
            expect(authService).toBeDefined();
            expect(globalRoleService).toBeDefined();
        });

        it('should include default managers', () => {
            const globalRoleManager = module.get(Managers.GlobalRoleManager);

            expect(globalRoleManager).toBeDefined();
        });

        it('should include default collections', () => {
            const accountCollection = module.get(Collections.AccountCollection);
            const roleCollection = module.get(Collections.RoleCollection);
            const securityAuditCollection = module.get(Collections.SecurityAuditCollection);

            expect(accountCollection).toBeDefined();
            expect(roleCollection).toBeDefined();
            expect(securityAuditCollection).toBeDefined();
        });

        it('should include default controllers', () => {
            expect(controllers).toContain(Controllers.AccountController);
            expect(controllers).toContain(Controllers.AuditsController);
            expect(controllers).toContain(Controllers.GlobalRolesController);
            expect(controllers).toContain(Controllers.SecurityAuditsController);
        });

        it('should not include organization-related providers when organizations are disabled', () => {
            expect(() => module.get(PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA)).toThrow();
            expect(() => module.get(Collections.OrganizationCollection)).toThrow();
            expect(() => module.get(Services.OrganizationService)).toThrow();
        });

        it('should not include API key-related providers when API keys are disabled', () => {
            expect(() => module.get(Collections.ApiKeyCollection)).toThrow();
            expect(() => module.get(Services.ApiKeyService)).toThrow();
        });
    });

    describe('with organizations enabled', () => {
        let module: TestingModule;
        let providers: any[];
        let controllers: any[];
        beforeEach(async () => {
            jest.clearAllMocks();
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true
                }
            };
            const result = setupTrailmixCMS(options);
            providers = result.providers;
            controllers = result.controllers;
            module = await Test.createTestingModule({
                providers,
                controllers,
            }).compile();
        });

        it('should include organization controllers when enableOrganizations is true', () => {
            expect(controllers).toContain(Controllers.OrganizationsController);
            expect(controllers).toContain(Controllers.OrganizationRolesController);
        });

        it('should include organization providers when enableOrganizations is true', async () => {
            const organizationSchema = module.get(PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA);
            const organizationConfig = module.get(PROVIDER_SYMBOLS.ORGANIZATION_CONFIG);
            const organizationMapEntity = module.get(PROVIDER_SYMBOLS.ORGANIZATION_MAP_ENTITY);

            expect(organizationSchema).toBe(models.Organization.schema);
            expect(organizationConfig).toBeDefined();
            expect(organizationMapEntity).toBeDefined();
            // Organization setup should not be available when not provided
            expect(() => module.get(PROVIDER_SYMBOLS.ORGANIZATION_SETUP)).toThrow();
        });

        it('should not include organization setup provider when not provided', async () => {
            expect(() => module.get(PROVIDER_SYMBOLS.ORGANIZATION_SETUP)).toThrow();
        });

        it('should use default organization config when not provided', async () => {
            const organizationConfig = module.get(PROVIDER_SYMBOLS.ORGANIZATION_CONFIG);
            expect(organizationConfig).toBeDefined();
            expect(organizationConfig).toEqual({ disableDefaultIndexes: false });
        });

        it('should use default organization mapEntity function that returns entity as-is', async () => {
            const organizationMapEntity = module.get(PROVIDER_SYMBOLS.ORGANIZATION_MAP_ENTITY);
            expect(organizationMapEntity).toBeDefined();

            const testEntity = { _id: 'test-id', name: 'Test Organization' };
            const mapperFn = organizationMapEntity as (entity: any) => any;
            expect(mapperFn(testEntity)).toBe(testEntity);
        });

        it('should include organization services and managers when enableOrganizations is true', async () => {
            const organizationCollection = module.get(Collections.OrganizationCollection);
            const organizationService = module.get(Services.OrganizationService);
            const organizationRoleService = module.get(Services.OrganizationRoleService);
            const organizationRoleManager = module.get(Managers.OrganizationRoleManager);
            const organizationManager = module.get(Managers.OrganizationManager);
            const authorizationService = module.get(Services.AuthorizationService);

            expect(organizationCollection).toBeDefined();
            expect(organizationService).toBeDefined();
            expect(organizationRoleService).toBeDefined();
            expect(organizationRoleManager).toBeDefined();
            expect(organizationManager).toBeDefined();
            expect(authorizationService).toBeDefined();
        });
    });

    describe('with API keys enabled', () => {
        let module: TestingModule;
        let providers: any[];
        let controllers: any[];
        beforeEach(async () => {
            jest.clearAllMocks();
            const options: TrailmixCMSOptions = {
                features: {
                    apiKeys: {
                        enabled: true
                    }
                }
            };
            const result = setupTrailmixCMS(options);
            providers = result.providers;
            controllers = result.controllers;
            module = await Test.createTestingModule({
                providers,
                controllers,
            }).compile();
        });

        it('should include API key providers when apiKeys.enabled is true', () => {
            const apiKeyCollection = module.get(Collections.ApiKeyCollection);
            const apiKeyService = module.get(Services.ApiKeyService);

            expect(apiKeyCollection).toBeDefined();
            expect(apiKeyService).toBeDefined();
        });

        it('should include API keys controller when apiKeys.enabled is true', () => {
            expect(controllers).toContain(Controllers.ApiKeysController);
        });
    });

    describe('with both features enabled', () => {
        let module: TestingModule;
        let providers: any[];
        let controllers: any[];
        beforeEach(async () => {
            jest.clearAllMocks();
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true,
                    apiKeys: {
                        enabled: true
                    }
                }
            };
            const result = setupTrailmixCMS(options);
            providers = result.providers;
            controllers = result.controllers;
            module = await Test.createTestingModule({
                providers,
                controllers,
            }).compile();
        });

        it('should include both organization and API key providers', () => {
            const organizationCollection = module.get(Collections.OrganizationCollection);
            const apiKeyCollection = module.get(Collections.ApiKeyCollection);
            const organizationService = module.get(Services.OrganizationService);
            const apiKeyService = module.get(Services.ApiKeyService);

            expect(organizationCollection).toBeDefined();
            expect(apiKeyCollection).toBeDefined();
            expect(organizationService).toBeDefined();
            expect(apiKeyService).toBeDefined();
        });
    });

    describe('custom account configuration', () => {
        it('should use custom account schema when provided', async () => {
            const customSchema = z.object({
                _id: z.any().optional(),
                email: z.string(),
                customField: z.string()
            }) as any; // Type assertion for test schema
            const options: TrailmixCMSOptions = {
                entities: {
                    accountSchema: customSchema
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const accountSchema = module.get(PROVIDER_SYMBOLS.ACCOUNT_SCHEMA);
            expect(accountSchema).toBe(customSchema);
        });

        it('should use custom account setup when provided', async () => {
            const customSetup = jest.fn(async (collection: Collection<any>) => {
                await collection.createIndex({ email: 1 });
            });
            const options: TrailmixCMSOptions = {
                entities: {
                    accountSetup: customSetup
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const accountSetup = module.get(PROVIDER_SYMBOLS.ACCOUNT_SETUP);
            expect(accountSetup).toBe(customSetup);
        });

        it('should use custom account config when provided', async () => {
            const customConfig = {
                disableDefaultIndexes: true
            };
            const options: TrailmixCMSOptions = {
                entities: {
                    accountConfig: customConfig
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const accountConfig = module.get(PROVIDER_SYMBOLS.ACCOUNT_CONFIG);
            expect(accountConfig).toEqual(customConfig);
        });

        it('should use custom account mapEntity when provided', async () => {
            const customMapper = (entity: any) => ({ ...entity, mapped: true });
            const options: TrailmixCMSOptions = {
                entities: {
                    accountMapEntity: customMapper
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const accountMapEntity = module.get(PROVIDER_SYMBOLS.ACCOUNT_MAP_ENTITY);
            expect(accountMapEntity).toBe(customMapper);
        });
    });

    describe('custom organization configuration', () => {
        it('should use custom organization schema when provided', async () => {
            const customSchema = z.object({
                _id: z.any().optional(),
                name: z.string(),
                customField: z.string()
            }) as any; // Type assertion for test schema
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true
                },
                entities: {
                    organizationSchema: customSchema
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const organizationSchema = module.get(PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA);
            expect(organizationSchema).toBe(customSchema);
        });

        it('should use custom organization setup when provided', async () => {
            const customSetup = jest.fn(async (collection: Collection<any>) => {
                await collection.createIndex({ name: 1 });
            });
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true
                },
                entities: {
                    organizationSetup: customSetup
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const organizationSetup = module.get(PROVIDER_SYMBOLS.ORGANIZATION_SETUP);
            expect(organizationSetup).toBe(customSetup);
        });

        it('should use custom organization config when provided', async () => {
            const customConfig = {
                disableDefaultIndexes: true
            };
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true
                },
                entities: {
                    organizationConfig: customConfig
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const organizationConfig = module.get(PROVIDER_SYMBOLS.ORGANIZATION_CONFIG);
            expect(organizationConfig).toEqual(customConfig);
        });

        it('should use custom organization mapEntity when provided', async () => {
            const customMapper = (entity: any) => ({ ...entity, mapped: true });
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: true
                },
                entities: {
                    organizationMapEntity: customMapper
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const organizationMapEntity = module.get(PROVIDER_SYMBOLS.ORGANIZATION_MAP_ENTITY);
            expect(organizationMapEntity).toBe(customMapper);
        });

        it('should not include organization providers when enableOrganizations is false', async () => {
            const customSchema = z.object({
                _id: z.any().optional(),
                name: z.string()
            }) as any; // Type assertion for test schema
            const options: TrailmixCMSOptions = {
                features: {
                    enableOrganizations: false
                },
                entities: {
                    organizationSchema: customSchema
                }
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            expect(() => module.get(PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA)).toThrow();
        });
    });

    describe('FeatureService initialization', () => {
        it('should initialize FeatureService with provided features', async () => {
            const features = {
                enableOrganizations: true,
                apiKeys: {
                    enabled: true as const
                }
            };
            const options: TrailmixCMSOptions = {
                features
            };
            const result = setupTrailmixCMS(options);
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const featureService = module.get(Services.FeatureService);
            expect(featureService).toBeDefined();
            expect((featureService as any).features).toEqual(features);
        });

        it('should initialize FeatureService with undefined when no features provided', async () => {
            const result = setupTrailmixCMS();
            const module: TestingModule = await Test.createTestingModule({
                providers: result.providers,
                controllers: result.controllers,
            }).compile();

            const featureService = module.get(Services.FeatureService);
            expect(featureService).toBeDefined();
            expect((featureService as any).features).toBeUndefined();
        });
    });

    describe('collection factory calls', () => {
        it('should call collectionFactory for default collections', () => {
            const { collectionFactory } = require('@trailmix-cms/db');
            setupTrailmixCMS();

            expect(collectionFactory).toHaveBeenCalledWith(CMSCollectionName.Account);
            expect(collectionFactory).toHaveBeenCalledWith(CMSCollectionName.Role);
            expect(collectionFactory).toHaveBeenCalledWith(CMSCollectionName.SecurityAudit);
        });

        it('should call collectionFactory for organization collection when enabled', () => {
            const { collectionFactory } = require('@trailmix-cms/db');
            setupTrailmixCMS({
                features: {
                    enableOrganizations: true
                }
            });

            expect(collectionFactory).toHaveBeenCalledWith(CMSCollectionName.Organization);
        });

        it('should call collectionFactory for API key collection when enabled', () => {
            const { collectionFactory } = require('@trailmix-cms/db');
            setupTrailmixCMS({
                features: {
                    apiKeys: {
                        enabled: true
                    }
                }
            });

            expect(collectionFactory).toHaveBeenCalledWith(CMSCollectionName.ApiKey);
        });
    });
});
