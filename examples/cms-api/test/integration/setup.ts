import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_PIPE, APP_INTERCEPTOR } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { ConfigModule } from '@nestjs/config';
import * as models from '@trailmix-cms/models';
import { collectionFactory, configuration as databaseConfiguration } from '@trailmix-cms/db';
import {
    setupTrailmixCMS,
    provideAuthGuardHook,
    provideOrganizationDeleteHook,
    Services,
    configuration as cmsConfiguration,
    type RequestPrincipal,
} from '@trailmix-cms/cms';

import { controllers } from '../../src/controllers';
import { collections } from '../../src/collections';
import { services } from '../../src/services';
import { CollectionName } from '../../src/constants';
import * as appModels from '../../src/models';
import { AppAuthGuardHook, AppOrganizationDeleteHook } from '../../src/hooks';

const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/?replicaSet=rs0';
const MONGODB_DATABASE_NAME = `integration_test_${Date.now()}`;

export interface TestContext {
    app: NestFastifyApplication;
    mongoClient: MongoClient;
    db: Db;
    testAccountId: ObjectId;
    testOrganizationId: ObjectId;
    principal: RequestPrincipal;
}

export async function createTestContext(): Promise<TestContext> {
    const testAccountId = new ObjectId();
    const testOrganizationId = new ObjectId();

    const testPrincipal: RequestPrincipal = {
        principal_type: models.Principal.Account,
        entity: {
            _id: testAccountId,
            user_id: `test_user_${testAccountId.toHexString()}`,
            name: 'Test Account',
            created_at: new Date(),
        } as models.Account.Entity,
    };

    // Connect directly for verification queries
    const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DATABASE_NAME);

    // Seed the account into the database so auth-related lookups work
    await db.collection('account').insertOne({
        _id: testAccountId,
        user_id: (testPrincipal.entity as models.Account.Entity).user_id,
        name: 'Test Account',
        created_at: new Date(),
    });

    // Seed the organization
    await db.collection('organization').insertOne({
        _id: testOrganizationId,
        name: 'Test Organization',
        description: 'Integration test organization',
        created_at: new Date(),
    });

    // Seed an Owner role so authorization checks pass
    await db.collection('role').insertOne({
        _id: new ObjectId(),
        type: models.RoleType.Organization,
        principal_id: testAccountId,
        principal_type: models.Principal.Account,
        organization_id: testOrganizationId,
        role: models.RoleValue.Owner,
        created_at: new Date(),
    });

    // Set env vars for the NestJS ConfigModule
    process.env.MONGODB_CONNECTION_STRING = MONGODB_CONNECTION_STRING;
    process.env.MONGODB_DATABASE_NAME = MONGODB_DATABASE_NAME;
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_integration';
    process.env.CLERK_SECRET_KEY = 'sk_test_integration';
    process.env.NODE_ENV = 'test';

    const features = {
        enableOrganizations: true,
        apiKeys: {
            enabled: true as const,
            scopes: [
                models.ApiKeyScope.Account,
                models.ApiKeyScope.Global,
                models.ApiKeyScope.Organization,
            ],
        },
    };

    const trailmixCMS = setupTrailmixCMS({
        entities: {
            accountSchema: appModels.Account.entitySchema,
            organizationSchema: appModels.Organization.entitySchema,
        },
        features,
    });

    const configuration = () => ({
        NODE_ENV: 'test',
        PORT: 0,
        SERVICE_HOST: 'http://localhost:0',
        GENERATE_SPEC: false,
        CLERK_PUBLISHABLE_KEY: 'pk_test_integration',
        CLERK_SECRET_KEY: 'sk_test_integration',
        BUILD_ID: 'integration-test',
        onModuleInit: false,
    });

    const moduleBuilder = Test.createTestingModule({
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
            ...collections,
            ...Object.values(CollectionName).map(collectionName => collectionFactory(collectionName)),
        ],
    });

    // Override the AuthService so getPrincipal returns our test principal
    // without invoking Clerk's getAuth(). The real AuthGuard calls
    // AuthService.getPrincipal() and AuthService.validateAuth(), so we
    // only need to stub getPrincipal.
    moduleBuilder.overrideProvider(Services.AuthService).useValue({
        getPrincipal: async () => testPrincipal,
        validateAuth: async () => 'isValid',
        getAccountFromPrincipal: async () => testPrincipal.entity,
    });

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    const app = moduleFixture.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    return {
        app,
        mongoClient,
        db,
        testAccountId,
        testOrganizationId,
        principal: testPrincipal,
    };
}

export async function teardownTestContext(ctx: TestContext | undefined): Promise<void> {
    if (!ctx) return;
    if (ctx.db) await ctx.db.dropDatabase().catch(() => {});
    if (ctx.mongoClient) await ctx.mongoClient.close().catch(() => {});
    if (ctx.app) await ctx.app.close().catch(() => {});
}
