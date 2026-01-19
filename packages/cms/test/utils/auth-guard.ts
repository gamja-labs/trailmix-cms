import { AccountCollection } from '@/collections/account.collection';
import { AccountService } from '@/services/account.service';
import { SecurityAuditCollection } from '@/collections/security-audit.collection';
import { ApiKeyCollection } from '@/collections/api-key.collection';
import { AuthService } from '@/services/auth.service';
import { AuthGuardHook } from '@/types';
import { PROVIDER_SYMBOLS } from '@/constants';

export interface AuthGuardMocks {
    accountCollection: jest.Mocked<AccountCollection>;
    accountService: jest.Mocked<AccountService>;
    securityAuditCollection: jest.Mocked<SecurityAuditCollection>;
    apiKeyCollection: jest.Mocked<ApiKeyCollection>;
    authService: jest.Mocked<AuthService>;
    authGuardHook?: jest.Mocked<AuthGuardHook>;
}

export interface AuthGuardProviders {
    mocks: AuthGuardMocks;
    providers: any[];
}

/**
 * Creates mock dependencies and providers for AuthGuard testing.
 * 
 * @param overrides Optional overrides for default mock implementations
 * @returns Object containing mocks and providers array for NestJS TestingModule
 */
export function createAuthGuardDependencies(overrides?: {
    accountCollection?: Partial<jest.Mocked<AccountCollection>>;
    accountService?: Partial<jest.Mocked<AccountService>>;
    securityAuditCollection?: Partial<jest.Mocked<SecurityAuditCollection>>;
    apiKeyCollection?: Partial<jest.Mocked<ApiKeyCollection>>;
    authService?: Partial<jest.Mocked<AuthService>>;
    authGuardHook?: Partial<jest.Mocked<AuthGuardHook>>;
}): AuthGuardProviders {
    const mockAccountCollection: jest.Mocked<AccountCollection> = {
        findOne: jest.fn(),
        upsertOne: jest.fn(),
        ...overrides?.accountCollection,
    } as any;

    const mockAccountService: jest.Mocked<AccountService> = {
        getAccount: jest.fn(),
        upsertAccount: jest.fn(),
        ...overrides?.accountService,
    } as any;

    const mockSecurityAuditCollection: jest.Mocked<SecurityAuditCollection> = {
        insertOne: jest.fn(),
        ...overrides?.securityAuditCollection,
    } as any;

    const mockApiKeyCollection: jest.Mocked<ApiKeyCollection> = {
        findOne: jest.fn(),
        ...overrides?.apiKeyCollection,
    } as any;

    const mockAuthService: jest.Mocked<AuthService> = {
        getPrincipal: jest.fn(),
        validateAuth: jest.fn(),
        ...overrides?.authService,
    } as any;

    const mockAuthGuardHook: jest.Mocked<AuthGuardHook> | undefined = overrides?.authGuardHook
        ? {
            onHook: jest.fn(),
            ...overrides.authGuardHook,
        } as any
        : undefined;

    const providers = [
        {
            provide: AccountService,
            useValue: mockAccountService,
        },
        {
            provide: AccountCollection,
            useValue: mockAccountCollection,
        },
        {
            provide: SecurityAuditCollection,
            useValue: mockSecurityAuditCollection,
        },
        {
            provide: ApiKeyCollection,
            useValue: mockApiKeyCollection,
        },
        {
            provide: AuthService,
            useValue: mockAuthService,
        },
        ...(mockAuthGuardHook
            ? [
                {
                    provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
                    useValue: mockAuthGuardHook,
                },
            ]
            : []),
    ];

    return {
        mocks: {
            accountCollection: mockAccountCollection,
            accountService: mockAccountService,
            securityAuditCollection: mockSecurityAuditCollection,
            apiKeyCollection: mockApiKeyCollection,
            authService: mockAuthService,
            ...(mockAuthGuardHook ? { authGuardHook: mockAuthGuardHook } : {}),
        },
        providers,
    };
}
