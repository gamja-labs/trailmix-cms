import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { OrganizationManager } from '@/managers';
import { OrganizationCollection, SecurityAuditCollection } from '@/collections';
import { AuthorizationService, OrganizationRoleService, OrganizationService } from '@/services';
import { RequestPrincipal } from '@/types';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';

describe('OrganizationManager', () => {
    let manager: OrganizationManager;
    let organizationCollection: jest.Mocked<OrganizationCollection>;
    let authorizationService: jest.Mocked<AuthorizationService>;
    let organizationRoleService: jest.Mocked<OrganizationRoleService>;
    let organizationService: jest.Mocked<OrganizationService>;
    let securityAuditCollection: jest.Mocked<SecurityAuditCollection>;

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

        const mockOrganizationCollection = {
            find: jest.fn(),
            get: jest.fn(),
            findOneAndUpdate: jest.fn(),
        };

        const mockAuthorizationService = {
            isGlobalAdmin: jest.fn(),
            resolveAuthorization: jest.fn(),
            resolveOrganizationAuthorization: jest.fn(),
        };

        const mockOrganizationRoleService = {
            find: jest.fn(),
        };

        const mockOrganizationService = {
            deleteOrganization: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationManager,
                {
                    provide: OrganizationCollection,
                    useValue: mockOrganizationCollection,
                },
                {
                    provide: AuthorizationService,
                    useValue: mockAuthorizationService,
                },
                {
                    provide: OrganizationRoleService,
                    useValue: mockOrganizationRoleService,
                },
                {
                    provide: OrganizationService,
                    useValue: mockOrganizationService,
                },
                {
                    provide: SecurityAuditCollection,
                    useValue: mockSecurityAuditCollection,
                },
            ],
        }).compile();

        manager = module.get<OrganizationManager>(OrganizationManager);
        organizationCollection = module.get(OrganizationCollection);
        authorizationService = module.get(AuthorizationService);
        organizationRoleService = module.get(OrganizationRoleService);
        organizationService = module.get(OrganizationService);
        securityAuditCollection = module.get(SecurityAuditCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('find', () => {
        const filter = {};

        it('returns all organizations when user is global admin (ensuring global admin can view all organizations)', async () => {
            const organizations = [
                TestUtils.Entities.createOrganization(),
                TestUtils.Entities.createOrganization(),
            ];
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            organizationCollection.find.mockResolvedValue(organizations);

            const result = await manager.find(filter, accountPrincipal);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(organizationCollection.find).toHaveBeenCalledWith(filter);
            expect(result).toEqual(organizations);
        });

        it('returns only organizations user belongs to when user is not global admin (ensuring non-global admin can only view organizations they belong to)', async () => {
            const organization1 = TestUtils.Entities.createOrganization({ _id: organizationId });
            const organizationRoles = [
                TestUtils.Models.createOrganizationRoleModel({
                    organization_id: organizationId,
                    principal_id: accountEntity._id,
                    principal_type: accountPrincipal.principal_type,
                    role: trailmixModels.RoleValue.User,
                }),
            ];
            authorizationService.isGlobalAdmin.mockResolvedValue(false);
            organizationRoleService.find.mockResolvedValue(organizationRoles);
            organizationCollection.find.mockResolvedValue([organization1]);

            const result = await manager.find(filter, accountPrincipal);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(organizationRoleService.find).toHaveBeenCalledWith({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                role: {
                    $in: [
                        trailmixModels.RoleValue.Owner,
                        trailmixModels.RoleValue.Admin,
                        trailmixModels.RoleValue.User,
                        trailmixModels.RoleValue.Reader,
                    ],
                },
            });
            expect(organizationCollection.find).toHaveBeenCalledWith({
                ...filter,
                _id: { $in: [organizationId] },
            });
            expect(result).toEqual([organization1]);
        });

        it('returns empty array when user has no organization roles (ensuring no organizations are returned when user has no organization roles)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(false);
            organizationRoleService.find.mockResolvedValue([]);

            const result = await manager.find(filter, accountPrincipal);

            expect(organizationRoleService.find).toHaveBeenCalled();
            expect(organizationCollection.find).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });

    describe('get', () => {
        const organization = TestUtils.Entities.createOrganization({ _id: organizationId });

        it('successfully gets an organization when user has reader access (ensuring reader access allows viewing organizations)', async () => {
            const readerRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Reader,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [readerRole],
            });

            const result = await manager.get(organization, accountPrincipal);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                principal: accountPrincipal,
                rolesAllowList: [
                    trailmixModels.RoleValue.Owner,
                    trailmixModels.RoleValue.Admin,
                    trailmixModels.RoleValue.User,
                    trailmixModels.RoleValue.Reader,
                ],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId: organizationId,
            });
            expect(result).toEqual(organization);
        });

        it('throws NotFoundException when user does not have access (ensuring user with no access is rejected)', async () => {
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.get(organization, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
        const update = { name: 'Updated Organization Name' };

        it('successfully updates an organization when user has admin access (ensuring admin access allows updating organizations)', async () => {
            const updatedOrganization = TestUtils.Entities.createOrganization({
                _id: organizationId,
                name: 'Updated Organization Name',
            });
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationCollection.findOneAndUpdate.mockResolvedValue(updatedOrganization);

            const result = await manager.update(organization, update, accountPrincipal, auditContext);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId: organizationId,
            });
            expect(organizationCollection.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: organizationId },
                update,
                auditContext,
            );
            expect(result).toEqual(updatedOrganization);
        });

        it('throws ForbiddenException when user has organization access but not admin role (ensuring only admins can update organizations)', async () => {
            const readerRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Reader,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [readerRole],
            });

            await expect(
                manager.update(organization, update, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationCollection.findOneAndUpdate).not.toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
        });

        it('throws NotFoundException when user has no organization access (ensuring user with no access is rejected)', async () => {
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.update(organization, update, accountPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationCollection.findOneAndUpdate).not.toHaveBeenCalled();
        });

        it('throws InternalServerErrorException when organization is not found after update (unlikely race condition)', async () => {
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationCollection.findOneAndUpdate.mockResolvedValue(undefined as any);

            await expect(
                manager.update(organization, update, accountPrincipal, auditContext)
            ).rejects.toThrow(InternalServerErrorException);

            expect(organizationCollection.findOneAndUpdate).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        const organization = TestUtils.Entities.createOrganization({ _id: organizationId });

        it('successfully deletes an organization when user has admin access (ensuring admin access allows deleting organizations)', async () => {
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationService.deleteOrganization.mockResolvedValue({
                organizationDeleted: true,
                rolesDeletedCount: 2,
            });

            await manager.delete(organization, accountPrincipal, auditContext);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId: organizationId,
            });
            expect(organizationService.deleteOrganization).toHaveBeenCalledWith(organizationId, auditContext);
        });

        it('throws ForbiddenException when user has organization access but not admin role (ensuring only admins can delete organizations)', async () => {
            const readerRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Reader,
            });
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [readerRole],
            });

            await expect(
                manager.delete(organization, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationService.deleteOrganization).not.toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
        });

        it('throws NotFoundException when user has no organization access (ensuring user with no access is rejected)', async () => {
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.delete(organization, accountPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationService.deleteOrganization).not.toHaveBeenCalled();
        });
    });
});
