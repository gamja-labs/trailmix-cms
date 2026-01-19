import { AuthGuard } from '../auth.guard'
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';

import * as trailmixModels from '@trailmix-cms/models';

export const ALLOW_ANONYMOUS_KEY = 'allowAnonymous';
export const ROLES_KEY = 'roles';
export const PRINCIPAL_TYPES_KEY = 'principalTypes';

export interface AuthOptions {
    globalRoles?: trailmixModels.RoleValue[];
    allowAnonymous?: boolean;
    principalTypes?: trailmixModels.Principal[];
}

export function Auth({ globalRoles = [], allowAnonymous = false, principalTypes = [trailmixModels.Principal.Account] }: AuthOptions = { }) {
    return applyDecorators(
        SetMetadata(ROLES_KEY, globalRoles),
        SetMetadata(ALLOW_ANONYMOUS_KEY, allowAnonymous),
        SetMetadata(PRINCIPAL_TYPES_KEY, principalTypes),
        UseGuards(AuthGuard),
        ...(principalTypes.includes(trailmixModels.Principal.ApiKey) ? [ApiSecurity('api-key')] : []),
        ...(principalTypes.includes(trailmixModels.Principal.Account) ? [ApiBearerAuth()] : []),
    );
}