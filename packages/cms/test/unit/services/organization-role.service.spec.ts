import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { OrganizationRoleService } from '@/services';
import { RoleCollection } from '@/collections';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';
import { RequestPrincipal } from '@/types';

describe('OrganizationRoleService', () => {
    let service: OrganizationRoleService;
    let roleCollection: jest.Mocked<RoleCollection>;

    const accountEntity = TestUtils.Entities.createAccount();
    const accountPrincipal: RequestPrincipal = {
        principal_type: trailmixModels.Principal.Account,
        entity: accountEntity,
    };
    const auditContext = createAuditContextForPrincipal(accountPrincipal);
    const organizationId = new ObjectId();

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
                OrganizationRoleService,
                {
                    provide: RoleCollection,
                    useValue: mockRoleCollection,
                },
            ],
        }).compile();

        service = module.get<OrganizationRoleService>(OrganizationRoleService);
        roleCollection = module.get(RoleCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('insertOne', () => {
        it('successfully creates an organization role (ensuring organization role creation works)', async () => {
            const params = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...params,
                type: trailmixModels.RoleType.Organization,
            });

            roleCollection.insertOne.mockResolvedValue(roleEntity);

            const result = await service.insertOne(params, auditContext);

            expect(roleCollection.insertOne).toHaveBeenCalledWith(
                {
                    ...params,
                    type: trailmixModels.RoleType.Organization,
                },
                auditContext,
            );
            expect(result).toBeDefined();
            expect(result.principal_id).toEqual(params.principal_id);
            expect(result.principal_type).toEqual(params.principal_type);
            expect(result.organization_id).toEqual(params.organization_id);
            expect(result.role).toEqual(params.role);
        });

        it('sets type to Organization when creating role (ensuring type is correctly set)', async () => {
            const params = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...params,
                type: trailmixModels.RoleType.Organization,
            });

            roleCollection.insertOne.mockResolvedValue(roleEntity);

            await service.insertOne(params, auditContext);

            expect(roleCollection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: trailmixModels.RoleType.Organization,
                }),
                auditContext,
            );
        });
    });

    describe('find', () => {
        it('successfully finds organization roles with filter (ensuring filtered queries work)', async () => {
            const filter = {
                principal_id: new ObjectId(),
                organization_id: organizationId,
            };
            const roleEntities = [
                TestUtils.Entities.createRole({
                    ...filter,
                    type: trailmixModels.RoleType.Organization,
                    role: trailmixModels.RoleValue.Admin,
                }),
                TestUtils.Entities.createRole({
                    ...filter,
                    type: trailmixModels.RoleType.Organization,
                    role: trailmixModels.RoleValue.User,
                }),
            ];

            roleCollection.find.mockResolvedValue(roleEntities);

            const result = await service.find(filter);

            expect(roleCollection.find).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });
            expect(result).toHaveLength(2);
            expect(result[0].principal_id).toEqual(filter.principal_id);
            expect(result[0].organization_id).toEqual(filter.organization_id);
            expect(result[1].principal_id).toEqual(filter.principal_id);
            expect(result[1].organization_id).toEqual(filter.organization_id);
        });

        it('returns empty array when no organization roles found (ensuring empty results are handled)', async () => {
            roleCollection.find.mockResolvedValue([]);

            const result = await service.find({});

            expect(result).toEqual([]);
        });

        it('filters by type Organization only (ensuring only organization roles are returned)', async () => {
            const filter = { role: trailmixModels.RoleValue.Admin };
            const organizationRoleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Organization,
                organization_id: organizationId,
            });

            roleCollection.find.mockResolvedValue([organizationRoleEntity]);

            const result = await service.find(filter);

            expect(roleCollection.find).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });
            // The service should filter out non-organization roles in mapToModel
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('findOne', () => {
        it('successfully finds a single organization role (ensuring single role queries work)', async () => {
            const filter = {
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
            };
            const roleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });

            roleCollection.findOne.mockResolvedValue(roleEntity);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });
            expect(result).toBeDefined();
            expect(result?.principal_id).toEqual(filter.principal_id);
            expect(result?.organization_id).toEqual(filter.organization_id);
        });

        it('returns null when organization role not found (ensuring null results are handled)', async () => {
            const filter = {
                principal_id: new ObjectId(),
                organization_id: organizationId,
            };

            roleCollection.findOne.mockResolvedValue(null);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });
            expect(result).toBeNull();
        });

        it('filters by type Organization only (ensuring only organization roles are returned)', async () => {
            const filter = { _id: new ObjectId() };
            const organizationRoleEntity = TestUtils.Entities.createRole({
                ...filter,
                type: trailmixModels.RoleType.Organization,
                organization_id: organizationId,
            });

            roleCollection.findOne.mockResolvedValue(organizationRoleEntity);

            const result = await service.findOne(filter);

            expect(roleCollection.findOne).toHaveBeenCalledWith({
                ...filter,
                type: trailmixModels.RoleType.Organization,
            });
            expect(result).toBeDefined();
        });
    });

    describe('deleteOne', () => {
        it('successfully deletes an organization role (ensuring role deletion works)', async () => {
            const roleId = new ObjectId();

            roleCollection.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);

            await service.deleteOne(roleId, auditContext);

            expect(roleCollection.deleteOne).toHaveBeenCalledWith(roleId, auditContext);
        });
    });

    describe('mapToModel', () => {
        it('throws error when entity is not an organization role (ensuring type validation works)', async () => {
            const globalRoleEntity = TestUtils.Entities.createRole({
                type: trailmixModels.RoleType.Global,
            });

            roleCollection.find.mockResolvedValue([globalRoleEntity]);

            await expect(service.find({})).rejects.toThrow('Entity is not an organization role');
        });

        it('throws error when organization role lacks organization_id (ensuring organization_id validation works)', async () => {
            const roleEntityWithoutOrgId = {
                ...TestUtils.Entities.createRole({
                    type: trailmixModels.RoleType.Organization,
                    organization_id: organizationId,
                }),
                organization_id: undefined,
            } as any;

            roleCollection.find.mockResolvedValue([roleEntityWithoutOrgId]);

            await expect(service.find({})).rejects.toThrow('Organization role must have organization_id');
        });

        it('successfully maps organization role entity to model (ensuring mapping works)', async () => {
            const roleEntity = TestUtils.Entities.createRole({
                type: trailmixModels.RoleType.Organization,
                principal_id: new ObjectId(),
                principal_type: trailmixModels.Principal.Account,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });

            roleCollection.find.mockResolvedValue([roleEntity]);

            const result = await service.find({});

            expect(result).toHaveLength(1);
            expect(result[0].principal_id).toEqual(roleEntity.principal_id);
            expect(result[0].principal_type).toEqual(roleEntity.principal_type);
            expect(result[0].organization_id).toEqual(roleEntity.organization_id);
            expect(result[0].role).toEqual(roleEntity.role);
        });
    });
});
