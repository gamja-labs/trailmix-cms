import { ClassProvider } from '@nestjs/common';
import { PROVIDER_SYMBOLS } from '../constants';
import { AuthGuardHook } from '../auth-guard-hook';

/**
 * Creates a ClassProvider for the auth guard hook
 */
export function provideAuthGuardHook(Class: new (...args: any[]) => AuthGuardHook): ClassProvider<AuthGuardHook> {
    return {
        provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_AUTH_GUARD_HOOK,
        useClass: Class,
    };
}

