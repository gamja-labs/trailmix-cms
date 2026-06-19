import { ClassProvider } from '@nestjs/common';
import { PROVIDER_SYMBOLS } from './provider-symbols.js';
import { AuthGuardHook } from './types/hooks/auth-guard-hook.js';
import { OrganizationDeleteHook } from './types/hooks/organization-delete-hook.js';

/**
 * Creates a ClassProvider for the auth guard hook (runs when an account is first created).
 */
export function provideAuthGuardHook(Class: new (...args: any[]) => AuthGuardHook): ClassProvider<AuthGuardHook> {
    return {
        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
        useClass: Class,
    };
}

/**
 * Creates a ClassProvider for the organization delete hook (runs inside the org cascade-delete transaction).
 */
export function provideOrganizationDeleteHook(Class: new (...args: any[]) => OrganizationDeleteHook): ClassProvider<OrganizationDeleteHook> {
    return {
        provide: PROVIDER_SYMBOLS.ORGANIZATION_DELETE_HOOK,
        useClass: Class,
    };
}
