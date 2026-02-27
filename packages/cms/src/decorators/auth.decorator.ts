import { AuthGuard } from '../auth.guard'
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';

import * as trailmixModels from '@trailmix-cms/models';

export const AUTH_OPTIONS_KEY = 'authOptions';

export interface AuthOptions {
    allowAnonymous: boolean;
    requiredGlobalRoles: (trailmixModels.RoleValue | string)[];
    requiredPrincipalTypes: trailmixModels.Principal[];
    requiredApiKeyScopes: (trailmixModels.ApiKeyScope | string)[];
}

export function Auth({ requiredGlobalRoles = [], allowAnonymous = false, requiredPrincipalTypes = [trailmixModels.Principal.Account], requiredApiKeyScopes = [] }: Partial<AuthOptions> = {}) {
    return applyDecorators(
        SetMetadata(AUTH_OPTIONS_KEY, { requiredGlobalRoles, allowAnonymous, requiredPrincipalTypes, requiredApiKeyScopes }),
        UseGuards(AuthGuard),
        ...(requiredPrincipalTypes.includes(trailmixModels.Principal.ApiKey) ? [ApiSecurity('api-key')] : []),
        ...(requiredPrincipalTypes.includes(trailmixModels.Principal.Account) ? [ApiBearerAuth()] : []),
    );
}