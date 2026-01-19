import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import * as trailmixModels from '@trailmix-cms/models';

import * as TestUtils from '../../utils';

import { GlobalRoleManager } from '@/managers';
import { GlobalRoleService, AuthorizationService } from '@/services';
import { SecurityAuditCollection } from '@/collections';
import { RequestPrincipal } from '@/types';
import { createAuditContextForPrincipal } from '@/decorators/audit-context.decorator';

describe('GlobalRoleManager', () => {
    let manager: GlobalRoleManager;
    let globalRoleService: jest.Mocked<GlobalRoleService>;
    let authorizationService: jest.Mocked<AuthorizationService>;
    let securityAuditCollection: jest.Mocked<SecurityAuditCollection>;

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

        const mockGlobalRoleService = {
            insertOne: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            deleteOne: jest.fn(),
        };

        const mockAuthorizationService = {
            isGlobalAdmin: jest.fn(),
        };

        const mockSecurityAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GlobalRoleManager,
                {
                    provide: GlobalRoleService,
                    useValue: mockGlobalRoleService,
                },
                {
                    provide: AuthorizationService,
                    useValue: mockAuthorizationService,
                },
                {
                    provide: SecurityAuditCollection,
                    useValue: mockSecurityAuditCollection,
                },
            ],
        }).compile();

        manager = module.get<GlobalRoleManager>(GlobalRoleManager);
        globalRoleService = module.get(GlobalRoleService);
        authorizationService = module.get(AuthorizationService);
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
            principal_id: new ObjectId(),
            principal_type: trailmixModels.Principal.Account,
            role: trailmixModels.RoleValue.Admin,
        };

        it('successfully creates a global role when user is global admin and role does not exist (ensuring global role creation works)', async () => {
            const globalRole = TestUtils.Models.createGlobalRoleModel(params);
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(null);
            globalRoleService.insertOne.mockResolvedValue(globalRole);

            const result = await manager.insertOne(params, accountPrincipal, auditContext);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(globalRoleService.findOne).toHaveBeenCalledWith(params);
            expect(globalRoleService.insertOne).toHaveBeenCalledWith(params, auditContext);
            expect(result).toEqual(globalRole);
            expect(securityAuditCollection.insertOne).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when user is not global admin (ensuring only global admins can create global roles)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(false);

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).not.toHaveBeenCalled();
            expect(globalRoleService.insertOne).not.toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                message: 'Insufficient permissions to create global role',
                source: GlobalRoleManager.name,
            });
        });

        it('throws BadRequestException when role already exists (ensuring role uniqueness is enforced)', async () => {
            const existingRole = TestUtils.Models.createGlobalRoleModel(params);
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(existingRole);

            await expect(
                manager.insertOne(params, accountPrincipal, auditContext)
            ).rejects.toThrow(BadRequestException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).toHaveBeenCalledWith(params);
            expect(globalRoleService.insertOne).not.toHaveBeenCalled();
        });
    });

    describe('find', () => {
        const query = {
            principal_id: new ObjectId(),
        };

        it('successfully finds global roles when user is global admin (ensuring global role retrieval works)', async () => {
            const globalRoles = [
                TestUtils.Models.createGlobalRoleModel(),
                TestUtils.Models.createGlobalRoleModel(),
            ];
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.find.mockResolvedValue(globalRoles);

            const result = await manager.find(query, accountPrincipal);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(globalRoleService.find).toHaveBeenCalledWith(query);
            expect(result).toEqual(globalRoles);
        });

        it('throws ForbiddenException when user is not global admin (ensuring only global admins can find global roles)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(false);

            await expect(
                manager.find(query, accountPrincipal)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.find).not.toHaveBeenCalled();
            expect(securityAuditCollection.insertOne).toHaveBeenCalledWith({
                event_type: trailmixModels.SecurityAuditEventType.UnauthorizedAccess,
                principal_id: accountEntity._id,
                principal_type: accountPrincipal.principal_type,
                message: 'Insufficient permissions to find global roles',
                source: GlobalRoleManager.name,
            });
        });
    });

    describe('get', () => {
        const roleId = new ObjectId();

        it('successfully gets a global role when user is global admin and role exists (ensuring global role retrieval works)', async () => {
            const globalRole = TestUtils.Models.createGlobalRoleModel({ _id: roleId });
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(globalRole);

            const result = await manager.get(roleId, accountPrincipal);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(globalRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(result).toEqual(globalRole);
        });

        it('throws NotFoundException when role does not exist (ensuring role existence is validated)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(null);

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
        });

        it('throws ForbiddenException when user is not global admin (ensuring only global admins can get global roles)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(false);

            await expect(
                manager.get(roleId, accountPrincipal)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).not.toHaveBeenCalled();
        });
    });

    describe('deleteOne', () => {
        const roleId = new ObjectId();

        it('successfully deletes a global role when user is global admin and role exists (ensuring global role deletion works)', async () => {
            const globalRole = TestUtils.Models.createGlobalRoleModel({ _id: roleId });
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(globalRole);
            globalRoleService.deleteOne.mockResolvedValue(undefined);

            await manager.deleteOne(roleId, accountPrincipal, auditContext);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalledWith(
                accountEntity._id,
                accountPrincipal.principal_type,
            );
            expect(globalRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(globalRoleService.deleteOne).toHaveBeenCalledWith(roleId, auditContext);
        });

        it('throws NotFoundException when role does not exist (ensuring role existence is validated)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(true);
            globalRoleService.findOne.mockResolvedValue(null);

            await expect(
                manager.deleteOne(roleId, accountPrincipal, auditContext)
            ).rejects.toThrow(NotFoundException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).toHaveBeenCalledWith({ _id: roleId });
            expect(globalRoleService.deleteOne).not.toHaveBeenCalled();
        });

        it('throws ForbiddenException when user is not global admin (ensuring only global admins can delete global roles)', async () => {
            authorizationService.isGlobalAdmin.mockResolvedValue(false);

            await expect(
                manager.deleteOne(roleId, accountPrincipal, auditContext)
            ).rejects.toThrow(ForbiddenException);

            expect(authorizationService.isGlobalAdmin).toHaveBeenCalled();
            expect(globalRoleService.findOne).not.toHaveBeenCalled();
            expect(globalRoleService.deleteOne).not.toHaveBeenCalled();
        });
    });
});
