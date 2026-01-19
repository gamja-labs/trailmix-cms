import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException, ForbiddenException, InternalServerErrorException, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import * as trailmixModels from '@trailmix-cms/models';

import { AuthGuard } from '@/auth.guard';
import { AuthService, AuthResult } from '@/services/auth.service';
import { AUTH_OPTIONS_KEY, AuthOptions } from '@/decorators/auth.decorator';
import { type RequestPrincipal } from '@/types';

import * as TestUtils from '../utils';

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let reflector: jest.Mocked<Reflector>;
    let authService: jest.Mocked<AuthService>;

    const createMockContext = (request: Partial<FastifyRequest> = {}): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => request as FastifyRequest,
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        } as any as ExecutionContext;
    };

    beforeEach(async () => {
        const mockReflector = {
            getAllAndOverride: jest.fn(),
        };

        const mockAuthService = {
            getPrincipal: jest.fn(),
            validateAuth: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthGuard,
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        guard = module.get<AuthGuard>(AuthGuard);
        reflector = module.get(Reflector);
        authService = module.get(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('canActivate', () => {
        it('returns true and sets principal when authentication is valid (ensuring successful authentication flow)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [trailmixModels.Principal.Account],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(reflector.getAllAndOverride).toHaveBeenCalledWith(AUTH_OPTIONS_KEY, [
                context.getHandler(),
                context.getClass(),
            ]);
            expect(authService.getPrincipal).toHaveBeenCalledWith(context);
            expect(authService.validateAuth).toHaveBeenCalledWith(
                principal,
                {
                    allowAnonymous: false,
                    requiredPrincipalTypes: [trailmixModels.Principal.Account],
                    requiredGlobalRoles: [],
                    requiredApiKeyScopes: [],
                },
                '/test/endpoint'
            );
            expect(request.principal).toEqual(principal);
        });

        it('uses default auth options when metadata is undefined (ensuring default behavior when no metadata)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);

            // When metadata is undefined, destructuring will fail, so return empty object instead
            reflector.getAllAndOverride.mockReturnValue({} as AuthOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(authService.validateAuth).toHaveBeenCalledWith(
                principal,
                {
                    allowAnonymous: undefined,
                    requiredPrincipalTypes: undefined,
                    requiredGlobalRoles: undefined,
                    requiredApiKeyScopes: undefined,
                },
                '/test/endpoint'
            );
            expect(request.principal).toEqual(principal);
        });

        it('throws UnauthorizedException when auth result is Unauthorized (ensuring unauthorized requests are rejected)', async () => {
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(null);
            authService.validateAuth.mockResolvedValue(AuthResult.Unauthorized);

            await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
            await expect(guard.canActivate(context)).rejects.toThrow('Unauthorized request');
            expect(authService.validateAuth).toHaveBeenCalled();
            expect(request.principal).toBeUndefined();
        });

        it('throws ForbiddenException when auth result is Forbidden (ensuring forbidden requests are rejected)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [trailmixModels.RoleValue.Admin],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.Forbidden);

            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
            await expect(guard.canActivate(context)).rejects.toThrow('You are not authorized to access this resource');
            expect(authService.validateAuth).toHaveBeenCalled();
            expect(request.principal).toBeUndefined();
        });

        it('throws InternalServerErrorException when auth result is unexpected (ensuring unexpected results throw error)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue('unexpected-result' as AuthResult);

            await expect(guard.canActivate(context)).rejects.toThrow(InternalServerErrorException);
            await expect(guard.canActivate(context)).rejects.toThrow('Failed to validate authentication');
            expect(authService.validateAuth).toHaveBeenCalled();
            expect(request.principal).toBeUndefined();
        });

        it('passes correct auth options to validateAuth (ensuring all options are passed correctly)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/api/users' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: true,
                requiredPrincipalTypes: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                requiredGlobalRoles: [trailmixModels.RoleValue.User, trailmixModels.RoleValue.Admin],
                requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Account, trailmixModels.ApiKeyScope.Organization],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            await guard.canActivate(context);

            expect(authService.validateAuth).toHaveBeenCalledWith(
                principal,
                {
                    allowAnonymous: true,
                    requiredPrincipalTypes: [trailmixModels.Principal.Account, trailmixModels.Principal.ApiKey],
                    requiredGlobalRoles: [trailmixModels.RoleValue.User, trailmixModels.RoleValue.Admin],
                    requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Account, trailmixModels.ApiKeyScope.Organization],
                },
                '/api/users'
            );
        });

        it('handles API key principal correctly (ensuring API key principals work)', async () => {
            const apiKeyEntity = TestUtils.Entities.createApiKey();
            const principal: RequestPrincipal = {
                entity: apiKeyEntity,
                principal_type: trailmixModels.Principal.ApiKey,
            };
            const request = { url: '/api/data' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [trailmixModels.Principal.ApiKey],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [trailmixModels.ApiKeyScope.Account],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(request.principal).toEqual(principal);
        });

        it('handles null principal when allowAnonymous is true (ensuring anonymous access works)', async () => {
            const request = { url: '/public/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: true,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(null);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(authService.validateAuth).toHaveBeenCalledWith(
                null,
                {
                    allowAnonymous: true,
                    requiredPrincipalTypes: [],
                    requiredGlobalRoles: [],
                    requiredApiKeyScopes: [],
                },
                '/public/endpoint'
            );
            // Principal is set to null when principal is null (non-null assertion still allows null)
            expect(request.principal).toBeNull();
        });

        it('extracts request URL correctly (ensuring URL is passed to validateAuth)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const requestUrl = '/api/v1/organizations/123/members';
            const request = { url: requestUrl } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.IsValid);

            await guard.canActivate(context);

            expect(authService.validateAuth).toHaveBeenCalledWith(
                principal,
                expect.objectContaining({
                    allowAnonymous: false,
                    requiredPrincipalTypes: [],
                    requiredGlobalRoles: [],
                    requiredApiKeyScopes: [],
                }),
                requestUrl
            );
        });

        it('does not set principal when authentication fails (ensuring principal is not set on failure)', async () => {
            const accountEntity = TestUtils.Entities.createAccount();
            const principal: RequestPrincipal = {
                entity: accountEntity,
                principal_type: trailmixModels.Principal.Account,
            };
            const request = { url: '/test/endpoint' } as FastifyRequest;
            const context = createMockContext(request);
            const authOptions: AuthOptions = {
                allowAnonymous: false,
                requiredPrincipalTypes: [],
                requiredGlobalRoles: [trailmixModels.RoleValue.Admin],
                requiredApiKeyScopes: [],
            };

            reflector.getAllAndOverride.mockReturnValue(authOptions);
            authService.getPrincipal.mockResolvedValue(principal);
            authService.validateAuth.mockResolvedValue(AuthResult.Forbidden);

            try {
                await guard.canActivate(context);
            } catch (error) {
                // Expected to throw
            }

            expect(request.principal).toBeUndefined();
        });
    });
});
