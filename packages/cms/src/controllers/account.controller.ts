import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import * as models from '@trailmix-cms/models';

import { Auth, PrincipalContext } from '../decorators';
import { PROVIDER_SYMBOLS } from '../constants/provider-symbols';
import { type RequestPrincipal } from '../types';
import * as dto from '../dto/account.dto';
import { GlobalRoleService } from '../services';

export function buildAccountController<
    AccountEntity extends models.Account.Entity = models.Account.Entity,
    AccountDtoEntity = AccountEntity
>(accountDto: any = createZodDto(models.Account.schema)) {

    @Auth({ requiredPrincipalTypes: [models.Principal.Account] })
    @ApiTags('account')
    @Controller('account')
    class AccountController {
        readonly logger = new Logger(AccountController.name);
        constructor(
            @Inject(PROVIDER_SYMBOLS.ACCOUNT_MAP_ENTITY) readonly accountMapEntity: (entity: AccountEntity) => AccountDtoEntity,
            readonly globalRoleService: GlobalRoleService,
        ) { }

        @Get()
        @ApiOperation({ summary: 'Get account info' })
        @ApiOkResponse({ description: 'Account info.', type: accountDto })
        async info(@PrincipalContext() principal: RequestPrincipal): Promise<AccountDtoEntity> {
            this.logger.log('info');
            this.logger.log(principal);
            return this.accountMapEntity(principal.entity as AccountEntity);
        }

        @Get('global-roles')
        @ApiOperation({ summary: 'Get global roles for the current account' })
        @ApiOkResponse({ description: 'Global roles for the account.', type: dto.AccountGlobalRoleListResponseDto })
        async getGlobalRoles(
            @PrincipalContext() principal: RequestPrincipal
        ): Promise<dto.AccountGlobalRoleListResponseDto> {
            this.logger.log('getGlobalRoles');
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
    return AccountController;
}

export const AccountController = buildAccountController();