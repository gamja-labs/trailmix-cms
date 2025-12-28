import { OptionalUnlessRequiredId } from 'mongodb';
import { ZodType } from 'zod';
import * as models from '@trailmix-cms/models';
import { PROVIDER_SYMBOLS } from './constants';
import { CMSCollectionName } from './constants';
import { collectionFactory } from '@trailmix-cms/db';
import { CollectionConfig } from './types/collection-config';

import { Collection } from 'mongodb';
import { AccountCollection, FileCollection, TextCollection } from './collections';
import { AccountService } from './services/account.service';
import { AuthGuardHook } from './auth-guard-hook';

export function configureCollections(options?: {
    features?: {
        file?: boolean,
        text?: boolean,
    }
}) {
    return {
        collectionNames: [
            CMSCollectionName.Account,
            ...(options?.features?.file ? [CMSCollectionName.File] : []),
            ...(options?.features?.text ? [CMSCollectionName.Text] : []),
        ],
        collections: [
            AccountCollection,
            ...(options?.features?.file ? [FileCollection] : []),
            ...(options?.features?.text ? [TextCollection] : []),
        ],
    }
}

export function createCmsProviders<
    AccountEntity extends models.Account.Entity = models.Account.Entity,
    AccountDtoEntity = AccountEntity,
    FileEntity extends models.File.Entity = models.File.Entity,
    TextEntity extends models.Text.Entity = models.Text.Entity
>(options?: {
    entities?: {
        accountSchema?: ZodType<OptionalUnlessRequiredId<AccountEntity>>,
        accountSetup?: (collection: Collection<AccountEntity>) => Promise<void>,
        accountDtoSchema?: ZodType<OptionalUnlessRequiredId<AccountDtoEntity>>,
        accountDto?: any,
        accountMapEntity?: (entity: AccountEntity) => AccountDtoEntity,
        accountConfig?: CollectionConfig,
        fileSchema?: ZodType<OptionalUnlessRequiredId<FileEntity>>,
        fileSetup?: (collection: Collection<FileEntity>) => Promise<void>,
        fileConfig?: CollectionConfig,
        textSchema?: ZodType<OptionalUnlessRequiredId<TextEntity>>,
        textSetup?: (collection: Collection<TextEntity>) => Promise<void>,
        textConfig?: CollectionConfig,
    },
    features?: {
        file?: boolean,
        text?: boolean,
    }
}) {
    const mongodbCollectionProviders = Object.values([
        CMSCollectionName.Account,
        ...(options?.features?.file ? [CMSCollectionName.File] : []),
        ...(options?.features?.text ? [CMSCollectionName.Text] : []),
    ]).map(collectionName => collectionFactory(collectionName));

    const defaultCollectionConfig: CollectionConfig = {
        disableDefaultIndexes: false
    }

    return [
        // Services
        AccountService,
        // Collections
        ...mongodbCollectionProviders,
        // Account
        {
            provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_SCHEMA,
            useValue: options?.entities?.accountSchema ?? models.Account.entitySchema
        },
        {
            provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_SETUP,
            useValue: options?.entities?.accountSetup ?? (async (collection: Collection<AccountEntity>) => { })
        },
        {
            provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_CONFIG,
            useValue: options?.entities?.accountConfig ?? defaultCollectionConfig
        },
        {
            provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_DTO_SCHEMA,
            useValue: options?.entities?.accountDtoSchema ?? models.Account.entitySchema
        },
        {
            provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_ACCOUNT_MAP_ENTITY,
            useValue: options?.entities?.accountMapEntity ?? (entity => entity)
        },
        // File
        ...(options?.features?.file ? [
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_FILE_SCHEMA,
                useValue: options?.entities?.fileSchema ?? models.File.entitySchema
            },
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_FILE_SETUP,
                useValue: options?.entities?.fileSetup ?? (async (collection: Collection<FileEntity>) => { })
            },
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_FILE_CONFIG,
                useValue: options?.entities?.fileConfig ?? defaultCollectionConfig
            },
        ] : []),
        // Text
        ...(options?.features?.text ? [
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_TEXT_SCHEMA,
                useValue: options?.entities?.textSchema ?? models.Text.entitySchema
            },
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_TEXT_SETUP,
                useValue: options?.entities?.textSetup ?? (async (collection: Collection<TextEntity>) => { })
            },
            {
                provide: PROVIDER_SYMBOLS.TRAILMIXCMS_CMS_TEXT_CONFIG,
                useValue: options?.entities?.textConfig ?? defaultCollectionConfig
            },
        ] : []),
        ...configureCollections(options).collections,
    ]
}