import { Controller, Get, Logger } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as models from '@trailmix-cms/models';

import { Auth, PrincipalContext } from '../decorators/index.js';
import { type RequestPrincipal } from '../types/index.js';
import { GlobalRoleService } from '../services/index.js';
import { AccountResponseDto, AccountGlobalRoleListResponseDto } from '../dto/account.dto.js';

@Auth({ requiredPrincipalTypes: [models.Principal.Account] })
@ApiTags('account')
@Controller('account')
export class AccountController {
    readonly logger = new Logger(AccountController.name);

    constructor(
        readonly globalRoleService: GlobalRoleService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get account info' })
    @ZodResponse({ status: 200, description: 'Account info.', type: AccountResponseDto })
    async info(@PrincipalContext() principal: RequestPrincipal): Promise<models.Account.Entity> {
        // The @Auth guard restricts this route to account principals.
        return principal.entity as models.Account.Entity;
    }

    @Get('global-roles')
    @ApiOperation({ summary: 'Get global roles for the current account' })
    @ZodResponse({ status: 200, description: 'Global roles for the account.', type: AccountGlobalRoleListResponseDto })
    async getGlobalRoles(
        @PrincipalContext() principal: RequestPrincipal
    ) {
        const roles = await this.globalRoleService.find({
            principal_id: principal.entity._id,
            principal_type: principal.principal_type,
        });
        return {
            items: roles,
            count: roles.length,
        };
    }
}
