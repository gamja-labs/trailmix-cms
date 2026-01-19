import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, Logger } from '@nestjs/common';
import { ObjectId, ClientSession } from 'mongodb';

import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { OrganizationService } from '@/services';
import { OrganizationCollection, RoleCollection } from '@/collections';
import { OrganizationRoleService } from '@/services/organization-role.service';
import { DatabaseService } from '@trailmix-cms/db';
import { OrganizationDeleteHook } from '@/types/hooks/organization-delete-hook';
import { PROVIDER_SYMBOLS } from '@/constants';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';
import { RequestPrincipal } from '@/types';

describe('OrganizationService', () => {
    let service: OrganizationService;
    let organizationCollection: jest.Mocked<OrganizationCollection>;
    let roleCollection: jest.Mocked<RoleCollection>;
    let organizationRoleService: jest.Mocked<OrganizationRoleService>;
    let databaseService: jest.Mocked<DatabaseService>;
    let organizationDeleteHook: jest.Mocked<OrganizationDeleteHook> | undefined;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockOrganizationCollection = {
            get: jest.fn(),
            deleteOne: jest.fn(),
        };

        const mockRoleCollection = {
            deleteOne: jest.fn(),
        };

        const mockOrganizationRoleService = {
            find: jest.fn(),
        };

        const mockDatabaseService = {
            withTransaction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationService,
                {
                    provide: OrganizationCollection,
                    useValue: mockOrganizationCollection,
                },
                {
                    provide: RoleCollection,
                    useValue: mockRoleCollection,
                },
                {
                    provide: OrganizationRoleService,
                    useValue: mockOrganizationRoleService,
                },
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
            ],
        }).compile();

        service = module.get<OrganizationService>(OrganizationService);
        organizationCollection = module.get(OrganizationCollection);
        roleCollection = module.get(RoleCollection);
        organizationRoleService = module.get(OrganizationRoleService);
        databaseService = module.get(DatabaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore Logger methods after all tests
        jest.restoreAllMocks();
    });

    describe('deleteOrganization', () => {
        const organizationId = new ObjectId();
        const accountEntity = TestUtils.Entities.createAccount();
        const accountPrincipal: RequestPrincipal = {
            principal_type: trailmixModels.Principal.Account,
            entity: accountEntity,
        };
        const auditContext = createAuditContextForPrincipal(accountPrincipal);

        it('throws NotFoundException when organization does not exist (ensuring failure on non-existent organizations is handled correctly)', async () => {
            organizationCollection.get.mockResolvedValue(null);

            await expect(
                service.deleteOrganization(organizationId, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationCollection.get).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).not.toHaveBeenCalled();
        });

        it('successfully deletes organization with no roles (ensuring organizations without roles can be deleted)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const mockSession = {} as ClientSession;

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue([]);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            const result = await service.deleteOrganization(organizationId, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
            expect(roleCollection.deleteOne).not.toHaveBeenCalled();
            expect(result).toEqual({
                organizationDeleted: true,
                rolesDeletedCount: 0,
            });
        });

        it('successfully deletes organization with multiple roles (ensuring cascade delete of roles works correctly)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role1 = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const role2 = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const role3 = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role1, role2, role3];
            const mockSession = {} as ClientSession;

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });
            roleCollection.deleteOne.mockResolvedValue(undefined as any);
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            const result = await service.deleteOrganization(organizationId, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            expect(roleCollection.deleteOne).toHaveBeenCalledTimes(3);
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role1._id, auditContext, mockSession);
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role2._id, auditContext, mockSession);
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role3._id, auditContext, mockSession);
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
            expect(result).toEqual({
                organizationDeleted: true,
                rolesDeletedCount: 3,
            });
        });

        it('successfully deletes organization with single role (ensuring single role deletion works)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role];
            const mockSession = {} as ClientSession;

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });
            roleCollection.deleteOne.mockResolvedValue(undefined as any);
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            const result = await service.deleteOrganization(organizationId, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            expect(roleCollection.deleteOne).toHaveBeenCalledTimes(1);
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role._id, auditContext, mockSession);
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
            expect(result).toEqual({
                organizationDeleted: true,
                rolesDeletedCount: 1,
            });
        });

        it('calls organization delete hook when provided (ensuring hook is executed within transaction)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role];
            const mockSession = {} as ClientSession;
            const mockHook: jest.Mocked<OrganizationDeleteHook> = {
                onHook: jest.fn().mockResolvedValue(undefined),
            };

            // Create a new module with the hook provider
            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    OrganizationService,
                    {
                        provide: OrganizationCollection,
                        useValue: organizationCollection,
                    },
                    {
                        provide: RoleCollection,
                        useValue: roleCollection,
                    },
                    {
                        provide: OrganizationRoleService,
                        useValue: organizationRoleService,
                    },
                    {
                        provide: DatabaseService,
                        useValue: databaseService,
                    },
                    {
                        provide: PROVIDER_SYMBOLS.ORGANIZATION_DELETE_HOOK,
                        useValue: mockHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<OrganizationService>(OrganizationService);

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });
            roleCollection.deleteOne.mockResolvedValue(undefined as any);
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            const result = await serviceWithHook.deleteOrganization(organizationId, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role._id, auditContext, mockSession);
            expect(mockHook.onHook).toHaveBeenCalledWith(organizationId, organization, auditContext, mockSession);
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
            expect(result).toEqual({
                organizationDeleted: true,
                rolesDeletedCount: 1,
            });
        });

        it('does not call organization delete hook when not provided (ensuring hook is optional)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role];
            const mockSession = {} as ClientSession;

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });
            roleCollection.deleteOne.mockResolvedValue(undefined as any);
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            const result = await service.deleteOrganization(organizationId, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role._id, auditContext, mockSession);
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
            expect(result).toEqual({
                organizationDeleted: true,
                rolesDeletedCount: 1,
            });
        });

        it('executes all operations within a single transaction (ensuring atomicity)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role1 = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const role2 = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role1, role2];
            const mockSession = {} as ClientSession;
            let transactionCallback: ((session: ClientSession) => Promise<any>) | null = null;

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                transactionCallback = fn;
                return await fn(mockSession);
            });
            roleCollection.deleteOne.mockResolvedValue(undefined as any);
            organizationCollection.deleteOne.mockResolvedValue(undefined as any);

            await service.deleteOrganization(organizationId, auditContext);

            // Verify that withTransaction was called
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));

            // Verify that all delete operations were called with the same session
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role1._id, auditContext, mockSession);
            expect(roleCollection.deleteOne).toHaveBeenCalledWith(role2._id, auditContext, mockSession);
            expect(organizationCollection.deleteOne).toHaveBeenCalledWith(organizationId, auditContext, mockSession);
        });

        it('handles transaction errors properly (ensuring transaction rollback on error)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const role = TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId });
            const organizationRoles = [role];
            const mockSession = {} as ClientSession;
            const transactionError = new Error('Transaction failed');

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                throw transactionError;
            });

            await expect(
                service.deleteOrganization(organizationId, auditContext)
            ).rejects.toThrow('Transaction failed');

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).toHaveBeenCalledWith(organizationId);
            expect(databaseService.withTransaction).toHaveBeenCalledWith({}, expect.any(Function));
            // Verify that delete operations were attempted but transaction failed
            expect(roleCollection.deleteOne).not.toHaveBeenCalled();
            expect(organizationCollection.deleteOne).not.toHaveBeenCalled();
        });

        it('handles hook errors within transaction (ensuring hook errors propagate)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const mockSession = {} as ClientSession;
            const hookError = new Error('Hook execution failed');
            const mockHook: jest.Mocked<OrganizationDeleteHook> = {
                onHook: jest.fn().mockRejectedValue(hookError),
            };

            // Create a new module with the hook provider
            const moduleWithHook: TestingModule = await Test.createTestingModule({
                providers: [
                    OrganizationService,
                    {
                        provide: OrganizationCollection,
                        useValue: organizationCollection,
                    },
                    {
                        provide: RoleCollection,
                        useValue: roleCollection,
                    },
                    {
                        provide: OrganizationRoleService,
                        useValue: organizationRoleService,
                    },
                    {
                        provide: DatabaseService,
                        useValue: databaseService,
                    },
                    {
                        provide: PROVIDER_SYMBOLS.ORGANIZATION_DELETE_HOOK,
                        useValue: mockHook,
                    },
                ],
            }).compile();

            const serviceWithHook = moduleWithHook.get<OrganizationService>(OrganizationService);

            organizationCollection.get.mockResolvedValue(organization);
            organizationRoleService.find.mockResolvedValue([]);
            databaseService.withTransaction.mockImplementation(async ({ }, fn) => {
                return await fn(mockSession);
            });

            await expect(
                serviceWithHook.deleteOrganization(organizationId, auditContext)
            ).rejects.toThrow('Hook execution failed');

            expect(mockHook.onHook).toHaveBeenCalledWith(organizationId, organization, auditContext, mockSession);
            expect(organizationCollection.deleteOne).not.toHaveBeenCalled();
        });
    });
});
