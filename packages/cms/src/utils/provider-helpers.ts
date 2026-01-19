import { ClassProvider } from '@nestjs/common';
import { PROVIDER_SYMBOLS } from '../constants';
import { AuthGuardHook } from '../types/hooks/auth-guard-hook';
import { OrganizationDeleteHook } from '../types/hooks/organization-delete-hook';

/**
 * Creates a ClassProvider for the auth guard hook
 */
export function provideAuthGuardHook(Class: new (...args: any[]) => AuthGuardHook): ClassProvider<AuthGuardHook> {
    return {
        provide: PROVIDER_SYMBOLS.AUTH_GUARD_HOOK,
        useClass: Class,
    };
}

/**
 * Creates a ClassProvider for the organization delete hook
 */
export function provideOrganizationDeleteHook(Class: new (...args: any[]) => OrganizationDeleteHook): ClassProvider<OrganizationDeleteHook> {
    return {
        provide: PROVIDER_SYMBOLS.ORGANIZATION_DELETE_HOOK,
        useClass: Class,
    };
}