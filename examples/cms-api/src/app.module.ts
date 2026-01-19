import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import type { Collection } from 'mongodb';

import { ApiKeyScope } from '@trailmix-cms/models';
import { collectionFactory, configuration as databaseConfiguration } from '@trailmix-cms/db';
import { provideAuthGuardHook, provideOrganizationDeleteHook, FeatureConfig, setupTrailmixCMS, configuration as cmsConfiguration } from '@trailmix-cms/cms';

import { controllers } from './controllers';
import { collections } from './collections';
import { services } from './services';
import { CollectionName } from './constants';
import { configuration } from './config';
import * as models from './models';
import { AppAuthGuardHook, AppOrganizationDeleteHook } from './hooks';

const features: FeatureConfig = {
    enableOrganizations: true,
    apiKeys: {
        enabled: true,
        scopes: [
            ApiKeyScope.Account,
            ApiKeyScope.Global,
            ApiKeyScope.Organization,
        ],
    },
};

const trailmixCMS = setupTrailmixCMS({
    entities: {
        accountSchema: models.Account.entitySchema,
        accountSetup: async (collection: Collection<models.Account.Entity>) => {
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
        organizationSchema: models.Organization.entitySchema,
        organizationSetup: async (collection: Collection<models.Organization.Entity>) => {
            await collection.createIndex({ name: 1 }, { sparse: true });
        },
    },
    features,
});

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration, databaseConfiguration, cmsConfiguration],
        }),
    ],
    controllers: [
        ...controllers,
        ...trailmixCMS.controllers,
    ],
    providers: [
        ...trailmixCMS.providers,
        provideAuthGuardHook(AppAuthGuardHook),
        provideOrganizationDeleteHook(AppOrganizationDeleteHook),
        {
            provide: APP_PIPE,
            useClass: ZodValidationPipe,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: ZodSerializerInterceptor,
        },
        ...services,
        // ...pipes,
        ...collections,
        ...Object.values(CollectionName).map(collectionName => collectionFactory(collectionName)),
    ],
})
export class AppModule { }
