import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as models from '@trailmix-cms/models';
import { DatabaseModule, Utils } from '@trailmix-cms/db';

import { configuration } from './config';
import { configureCollections, createCmsProviders } from './cms.providers';

export type CmsModuleOptions = {
    // For later use
}

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
        DatabaseModule
    ],
    exports: []
})
export class CmsModule {
    static async forRoot<
        AccountEntity extends models.Account.Entity = models.Account.Entity,
        AccountDtoEntity = AccountEntity,
        FileEntity extends models.File.Entity = models.File.Entity,
        TextEntity extends models.Text.Entity = models.Text.Entity
    >(options?: CmsModuleOptions & Parameters<typeof createCmsProviders<AccountEntity, AccountDtoEntity, FileEntity, TextEntity>>[0]): Promise<DynamicModule> {
        const providers = createCmsProviders<AccountEntity, AccountDtoEntity, FileEntity, TextEntity>(options);
        const { collectionNames, collections } = configureCollections(options);
        return {
            module: CmsModule,
            providers,
            controllers: [],
            exports: [
                ...providers,
                ...Utils.buildCollectionTokens(collectionNames),
                ...collections,
            ]
        };
    }
}