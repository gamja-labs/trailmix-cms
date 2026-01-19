import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { GlobalRoleService } from '@/services';
import { RoleCollection } from '@/collections';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';
import { RequestPrincipal } from '@/types';

describe('GlobalRoleService', () => {
    let service: GlobalRoleService;
    let roleCollection: jest.Mocked<RoleCollection>;

    const accountEntity = TestUtils.Entities.createAccount();
    const accountPrincipal: RequestPrincipal = {
        principal_type: trailmixModels.Principal.Account,
        entity: accountEntity,
    };
    const auditContext = createAuditContextForPrincipal(accountPrincipal);

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockRoleCollection = {
            insertOne: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            deleteOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GlobalRoleService,
                {
                    provide: RoleCollection,
                    useValue: mockRoleCollection,
                },
            ],
        }).compile();

        service = module.get<GlobalRoleService>(GlobalRoleService);
        roleCollection = module.get(RoleCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('insertOne', () => {
        it('successfully creates a global role (ensuring global role creation works)', async () => {
            const params = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                role: trailmixModels.RoleValue.Admin,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...params,
                type: trailmixModels.RoleType.Global,
            });
            const globalRoleModel = TestUtils.Models.createGlobalRoleModel(params);

            roleCollection.insertOne.mockResolvedValue(roleEntity);

            const result = await service.insertOne(params, auditContext);

            expect(roleCollection.insertOne).toHaveBeenCalledWith(
                {
                    ...params,
                    type: trailmixModels.RoleType.Global,
                },
                auditContext,
            );
            expect(result).toBeDefined();
            expect(result.principal_id).toEqual(params.principal_id);
            expect(result.principal_type).toEqual(params.principal_type);
            expect(result.role).toEqual(params.role);
        });

        it('sets type to Global when creating role (ensuring type is correctly set)', async () => {
            const params = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                role: trailmixModels.RoleValue.User,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...params,
                type: trailmixModels.RoleType.Global,
            });

            roleCollection.insertOne.mockResolvedValue(roleEntity);

            await service.insertOne(params, auditContext);

            expect(roleCollection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: trailmixModels.RoleType.Global,
                }),
                auditContext,
            );
        });
    });

    describe('find', () => {
        it('successfully finds global roles with filter (ensuring filtered queries work)', async () => {
            const filter = {
                principal_id: new ObjectId(),
            };
            const roleEntities = [
                TestUtils.Entities.createRole({
                    ...filter,
                    type: trailmixModels.RoleType.Global,
                    role: trailmixModels.RoleValue.Admin,
                }),
                TestUtils.Entities.createRole({
                    ...filter,
                    type: trailmixModels.RoleType.Global,
                    role: trailmixModels.RoleValue.User,
                }),
            ];

            roleCollection.find.mockResolvedValue(roleEntities);

            const result = await service.find(filter);

            expect(roleCollection.find).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });
            expect(result).toHaveLength(2);
            expect(result[0].principal_id).toEqual(filter.principal_id);
            expect(result[1].principal_id).toEqual(filter.principal_id);
        });

        it('successfully finds all global roles when no filter provided (ensuring unfiltered queries work)', async () => {
            const roleEntities = [
                TestUtils.Entities.createRole({ type: trailmixModels.RoleType.Global }),
                TestUtils.Entities.createRole({ type: trailmixModels.RoleType.Global }),
            ];

            roleCollection.find.mockResolvedValue(roleEntities);

            const result = await service.find();

            expect(roleCollection.find).toHaveBeenCalledWith({
                type: trailmixModels.RoleType.Global,
            });
            expect(result).toHaveLength(2);
        });

        it('returns empty array when no global roles found (ensuring empty results are handled)', async () => {
            roleCollection.find.mockResolvedValue([]);

            const result = await service.find();

            expect(result).toEqual([]);
        });

        it('filters by type Global only (ensuring only global roles are returned)', async () => {
            const filter = { role: trailmixModels.RoleValue.Admin };
            const globalRoleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });

            roleCollection.find.mockResolvedValue([globalRoleEntity]);

            const result = await service.find(filter);

            expect(roleCollection.find).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });
            // The service should filter out non-global roles in mapToModel
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('findOne', () => {
        it('successfully finds a single global role (ensuring single role queries work)', async () => {
            const filter = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });

            roleCollection.findOne.mockResolvedValue(roleEntity);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });
            expect(result).toBeDefined();
            expect(result?.principal_id).toEqual(filter.principal_id);
        });

        it('returns null when global role not found (ensuring null results are handled)', async () => {
            const filter = {
                principal_id: new ObjectId(),
            };

            roleCollection.findOne.mockResolvedValue(null);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });
            expect(result).toBeNull();
        });

        it('filters by type Global only (ensuring only global roles are returned)', async () => {
            const filter = { _id: new ObjectId() };
            const globalRoleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });

            roleCollection.findOne.mockResolvedValue(globalRoleEntity);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Global,
            });
            expect(result).toBeDefined();
        });
    });

    describe('deleteOne', () => {
        it('successfully deletes a global role (ensuring role deletion works)', async () => {
            const roleId = new ObjectId();

            roleCollection.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);

            await service.deleteOne(roleId, auditContext);

            expect(roleCollection.deleteOne).toHaveBeenCalledWith(roleId, auditContext);
        });
    });

    describe('mapToModel', () => {
        it('throws error when entity is not a global role (ensuring type validation works)', async () => {
            const organizationRoleEntity = TestUtils.Entities.createRole({
                type: trailmixModels.RoleType.Organization,
            });

            roleCollection.find.mockResolvedValue([organizationRoleEntity]);

            await expect(service.find({})).rejects.toThrow('Entity is not a global role');
        });

        it('successfully maps global role entity to model (ensuring mapping works)', async () => {
            const roleEntity = TestUtils.Entities.createRole({
                type: trailmixModels.RoleType.Global,
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                role: trailmixModels.RoleValue.Admin,
            });

            roleCollection.find.mockResolvedValue([roleEntity]);

            const result = await service.find({});

            expect(result).toHaveLength(1);
            expect(result[0].principal_id).toEqual(roleEntity.principal_id);
            expect(result[0].principal_type).toEqual(roleEntity.principal_type);
            expect(result[0].role).toEqual(roleEntity.role);
        });
    });
});
