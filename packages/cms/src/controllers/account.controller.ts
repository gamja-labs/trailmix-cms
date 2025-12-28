import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import * as models from '@trailmix-cms/models';
import { Auth } from '../decorators/auth.decorator';
import { PROVIDER_SYMBOLS } from '../constants/provider-symbols';
import { AccountContext } from '../decorators/account.decorator';
import { Account } from '@trailmix-cms/models';
import { createZodDto } from 'nestjs-zod';

export function buildAccountController<
    AccountEntity extends models.Account.Entity = models.Account.Entity,
    AccountDtoEntity = AccountEntity
>(accountDto: any = createZodDto(Account.entitySchema)) {

    @Auth()
    @ApiTags('account')
    @Controller('account')
    class AccountController {
        readonly logger = new Logger(AccountController.name);
        constructor(
            @Inject(PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_MAP_ENTITY) readonly accountMapEntity: (entity: AccountEntity) => AccountDtoEntity,
        ) { }

        @Get()
        @ApiOperation({ summary: 'Get account info' })
        @ApiOkResponse({ description: 'Account info.', type: accountDto })
        async info(@AccountContext() account: AccountEntity): Promise<AccountDtoEntity> {
            this.logger.log('info');
            this.logger.log(account);
            return this.accountMapEntity(account);
        }
    }
    return AccountController;
}

export const AccountController = buildAccountController();