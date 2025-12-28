import { Logger, Module } from '@nestjs/common';

import { DatabaseModule } from '@trailmix-cms/db';

import { controllers } from './controllers';
import { collections } from './collections';
import { services } from './services';
import { CollectionName } from './constants';
import { configuration } from './config';
import { ConfigModule } from '@nestjs/config';
import { collectionFactory } from '@trailmix-cms/db';
import { CmsModule, provideAuthGuardHook, Controllers } from '@trailmix-cms/cms';

import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import * as models from './models';
import type { Collection } from 'mongodb';
import * as AccountDto from './dto/account.dto';
import { AppAuthGuardHook } from './hooks/auth-guard.hook';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration],
        }),
        DatabaseModule,
        CmsModule.forRoot({
            entities: {
                accountSchema: models.Account.entitySchema,
                accountDtoSchema: AccountDto.entitySchema,
                accountDto: AccountDto.AccountDto,
                accountSetup: async (collection: Collection<models.Account.Entity>) => {
                    await collection.createIndex({ name: 1 }, { sparse: true });
                },
                accountMapEntity: (entity: models.Account.Entity) => {
                    const dto = {
                        ...entity,
                        roles: undefined,
                    } as AccountDto.Entity;
                    return dto;
                },
            },
        }),
        // CacheModule,
    ],
    controllers: [
        ...controllers,
        Controllers.buildAccountController<models.Account.Entity, AccountDto.Entity>(AccountDto.AccountDto),
        Controllers.AuditController,
    ],
    providers: [
        provideAuthGuardHook(AppAuthGuardHook),
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
