import { Logger, Module } from '@nestjs/common';

import { createDatabaseProviders, collectionFactory, configuration as databaseConfiguration } from '@trailmix-cms/db';

import { controllers } from './controllers';
import { collections } from './collections';
import { services } from './services';
import { CollectionName } from './constants';
import { configuration } from './config';
import { ConfigModule } from '@nestjs/config';

import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

const databaseProviders = createDatabaseProviders();

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration, databaseConfiguration],
        }),
    ],
    controllers: [
        ...controllers,
    ],
    providers: [
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
        ...databaseProviders,
    ],
})
export class AppModule { }
