import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { OrganizationRoleManager } from '@/managers';
import { OrganizationRoleService, AuthorizationService } from '@/services';
import { OrganizationCollection, SecurityAuditCollection } from '@/collections';
import { RequestPrincipal } from '@/types';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';

describe('OrganizationRoleManager', () => {
    let manager: OrganizationRoleManager;
    let organizationRoleService: jest.Mocked<OrganizationRoleService>;
    let authorizationService: jest.Mocked<AuthorizationService>;
    let organizationCollection: jest.Mocked<OrganizationCollection>;
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

        const mockOrganizationRoleService = {
            insertOne: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            deleteOne: jest.fn(),
        };

        const mockAuthorizationService = {
            isGlobalAdmin: jest.fn(),
            resolveAuthorization: jest.fn(),
            resolveOrganizationAuthorization: jest.fn(),
        };

        const mockOrganizationCollection = {
            get: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrganizationRoleManager,
                {
                    provide: OrganizationRoleService,
                    useValue: mockOrganizationRoleService,
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
            ],
        }).compile();

        manager = module.get<OrganizationRoleManager>(OrganizationRoleManager);
        organizationRoleService = module.get(OrganizationRoleService);
        authorizationService = module.get(AuthorizationService);
        organizationCollection = module.get(OrganizationCollection);
        securityAuditCollection = module.get(SecurityAuditCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('insertOne', () => {
        const params = {
            organization_id: organizationId,
            principal_id: new ObjectId(),
            principal_type: trailmixModels.Principal.Account,
            role: trailmixModels.RoleValue.Admin,
        };

        it('successfully creates an organization role when organization exists and user has admin access (ensuring organization role creation works)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const organizationRole = TestUtils.Models.createOrganizationRoleModel(params);
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationRoleService.findOne.mockResolvedValue(null);
            organizationRoleService.insertOne.mockResolvedValue(organizationRole);

            const result = await manager.insertOne(params, accountPrincipal, auditContext);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId: organizationId,
            });
            expect(organizationRoleService.findOne).toHaveBeenCalledWith(params);
            expect(organizationRoleService.insertOne).toHaveBeenCalledWith(params, auditContext);
            expect(result).toEqual(organizationRole);
        });

        it('throws BadRequestException when organization does not exist (ensuring organization existence is validated)', async () => {
            organizationCollection.get.mockResolvedValue(null);

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(BadRequestException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).not.toHaveBeenCalled();
            expect(organizationRoleService.insertOne).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when role already exists (ensuring role uniqueness is enforced)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const existingRole = TestUtils.Models.createOrganizationRoleModel(params);
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationRoleService.findOne.mockResolvedValue(existingRole);

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(BadRequestException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith(params);
            expect(organizationRoleService.insertOne).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when user has organization access but not admin role (ensuring users with lower roles cannot create organization roles)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const readerRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Reader,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [readerRole],
            });

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.insertOne).not.toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
        });

        it('throws BadRequestException when user has no organization access (ensuring user with no access is rejected)', async () => {
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(BadRequestException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.insertOne).not.toHaveBeenCalled();
        });
    });

    describe('find', () => {
        it('allows global admin to find all organization roles without organization_id (ensuring global admin can find all organization roles)', async () => {
            const params = {};
            const organizationRoles = [
                TestUtils.Models.createOrganizationRoleModel(),
                TestUtils.Models.createOrganizationRoleModel(),
            ];
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            organizationRoleService.find.mockResolvedValue(organizationRoles);

            const result = await manager.find(params, accountPrincipal);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(organizationRoleService.find).toHaveBeenCalledWith(params);
            expect(result).toEqual(organizationRoles);
        });

        it('throws BadRequestException when non-admin tries to find without organization_id (ensuring only admins can find organization roles)', async () => {
            const params = {};
            authorizationService.isGlobalAdmin.mockResolvedValue(false);

            await expect(
                manager.find(params, accountPrincipal)
            ).rejects.toThrow(BadRequestException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(organizationRoleService.find).not.toHaveBeenCalled();
        });

        it('successfully finds organization roles when user has admin access to organization (ensuring organization role retrieval works)', async () => {
            const params = { organization_id: organizationId };
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const organizationRoles = [
                TestUtils.Models.createOrganizationRoleModel({ organization_id: organizationId }),
            ];
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationRoleService.find.mockResolvedValue(organizationRoles);

            const result = await manager.find(params, accountPrincipal);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.find).toHaveBeenCalledWith(params);
            expect(result).toEqual(organizationRoles);
        });

        it('returns principal organization roles when non-admin user has organization access and queries their own roles (ensuring non-admin users can view their own roles)', async () => {
            const params = {
                organization_id: organizationId,
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
            };
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            const result = await manager.find(params, accountPrincipal);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.find).not.toHaveBeenCalled();
            expect(result).toEqual([userRole]);
        });

        it('throws BadRequestException when non-admin user tries to view other principal roles (ensuring non-admin users cannot view other principals roles)', async () => {
            const otherPrincipalId = new ObjectId();
            const params = {
                organization_id: organizationId,
                principal_id: otherPrincipalId,
            };
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            await expect(
                manager.find(params, accountPrincipal)
            ).rejects.toThrow(BadRequestException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.find).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when non-admin user tries to view other principal type roles (ensuring non-admin users cannot view other principal types)', async () => {
            const params = {
                organization_id: organizationId,
                principal_type: trailmixModels.Principal.ApiKey,
            };
            const organization = TestUtils.Entities.createOrganization({ _id: organizationId });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationCollection.get.mockResolvedValue(organization);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            await expect(
                manager.find(params, accountPrincipal)
            ).rejects.toThrow(BadRequestException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.find).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when organization does not exist (ensuring organization existence is validated)', async () => {
            const params = { organization_id: organizationId };
            organizationCollection.get.mockResolvedValue(null);

            await expect(
                manager.find(params, accountPrincipal)
            ).rejects.toThrow(BadRequestException);

            expect(organizationCollection.get).toHaveBeenCalledWith(organizationId);
            expect(organizationRoleService.find).not.toHaveBeenCalled();
        });
    });

    describe('get', () => {
        const roleId = new ObjectId();

        it('successfully gets an organization role when user has admin access (ensuring organization role retrieval works)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
            }); 
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });

            const result = await manager.get(roleId, accountPrincipal);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalledWith({
                principal: accountPrincipal,
                rolesAllowList: [trailmixModels.RoleValue.Admin, trailmixModels.RoleValue.Owner],
                principalTypeAllowList: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                organizationId: organizationId,
            });
            expect(result).toEqual(organizationRole);
        });

        it('successfully gets an organization role when non-admin user views their own role (ensuring non-admin users can view their own roles)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                role: trailmixModels.RoleValue.User,
            });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            const result = await manager.get(roleId, accountPrincipal);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(result).toEqual(organizationRole);
        });

        it('throws NotFoundException when role is assigned to different principal (ensuring users cannot view roles assigned to others)', async () => {
            const otherPrincipalId = new ObjectId();
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
                principal_id: otherPrincipalId,
                principal_type: accountPrincipal.principal_type,
            });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
        });

        it('throws NotFoundException when role is assigned to different principal type (ensuring users cannot view roles for other principal types)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
                principal_id: accountEntity._id,
                principal_type: trailmixModels.Principal.ApiKey,
            });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
        });

        it('throws NotFoundException when role does not exist (ensuring role existence is validated)', async () => {
            organizationRoleService.findOne.mockResolvedValue(null);

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when user does not have access (ensuring user with no access is rejected)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(BadRequestException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
        });
    });

    describe('deleteOne', () => {
        const roleId = new ObjectId();

        it('successfully deletes an organization role when user has admin access (ensuring organization role deletion works)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
            });
            const adminRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.Admin,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: true,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [adminRole],
            });
            organizationRoleService.deleteOne.mockResolvedValue(undefined);

            await manager.deleteOne(roleId, accountPrincipal, auditContext);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.deleteOne).toHaveBeenCalledWith(roleId, auditContext);
        });

        it('throws NotFoundException when role does not exist (ensuring role existence is validated)', async () => {
            organizationRoleService.findOne.mockResolvedValue(null);

            await expect(
                manager.deleteOne(roleId, accountPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(organizationRoleService.deleteOne).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when user does not have access (ensuring user with no access is rejected)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [],
            });

            await expect(
                manager.deleteOne(roleId, accountPrincipal, auditContext)
            ).rejects.toThrow(BadRequestException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(organizationRoleService.deleteOne).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when user has organization access but not admin role (ensuring only admins can delete organization roles)', async () => {
            const organizationRole = TestUtils.Models.createOrganizationRoleModel({
                _id: roleId,
                organization_id: organizationId,
            });
            const userRole = TestUtils.Models.createOrganizationRoleModel({
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                organization_id: organizationId,
                role: trailmixModels.RoleValue.User,
            });
            organizationRoleService.findOne.mockResolvedValue(organizationRole);
            authorizationService.resolveOrganizationAuthorization.mockResolvedValue({
                hasAccess: false,
                isGlobalAdmin: false,
                globalRoles: [],
                organizationRoles: [userRole],
            });

            await expect(
                manager.deleteOne(roleId, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(organizationRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(authorizationService.resolveOrganizationAuthorization).toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalled();
            expect(organizationRoleService.deleteOne).not.toHaveBeenCalled();
        });
    });
});
