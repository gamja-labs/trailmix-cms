import { TestingModule, Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongoClient, Db } from 'mongodb';
import { AuditContext } from '@trailmix-cms/models';
import {
    configuration as databaseConfiguration,
    createDatabaseProviders,
    collectionFactory,
    DatabaseService,
} from '../../src';
import { TestCollectionName } from './entities';
import {
    testCollectionServices,
    WidgetCollection,
    AuditedWidgetCollection,
    GadgetCollection,
} from './collections';

const MONGODB_CONNECTION_STRING =
    process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/?replicaSet=rs0';

/**
 * A shared audit context the tests can pass to audited / versioned writes.
 */
export const testAuditContext: AuditContext.Model = {
    system: true,
    source: 'db-integration-tests',
    message: 'integration test write',
};

export interface TestContext {
    moduleRef: TestingModule;
    mongoClient: MongoClient;
    db: Db;
    dbName: string;
    databaseService: DatabaseService;
    widgets: WidgetCollection;
    auditedWidgets: AuditedWidgetCollection;
    gadgets: GadgetCollection;
}

/**
 * Boots a NestJS module wired with the real db-library providers
 * ({@link DatabaseService}, the internal audit collections, and the test
 * collection services) pointed at a freshly-named database on the MongoDB
 * replica set. A second direct {@link MongoClient} is returned for raw
 * verification queries that bypass the library.
 */
export async function createTestContext(): Promise<TestContext> {
    const dbName = `db_integration_test_${Date.now()}`;

    // The connection/config factories read straight from process.env, so set
    // these before the ConfigModule loads.
    process.env.MONGODB_CONNECTION_STRING = MONGODB_CONNECTION_STRING;
    process.env.MONGODB_DATABASE_NAME = dbName;
    process.env.GENERATE_SPEC = 'false';
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({
                load: [databaseConfiguration],
            }),
        ],
        providers: [
            ...createDatabaseProviders(),
            ...testCollectionServices,
            ...Object.values(TestCollectionName).map((name) => collectionFactory(name)),
        ],
    }).compile();

    // init() runs onModuleInit hooks (index creation on the audit collections).
    await moduleRef.init();

    // Direct connection for verification queries.
    const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);

    return {
        moduleRef,
        mongoClient,
        db,
        dbName,
        databaseService: moduleRef.get(DatabaseService),
        widgets: moduleRef.get(WidgetCollection),
        auditedWidgets: moduleRef.get(AuditedWidgetCollection),
        gadgets: moduleRef.get(GadgetCollection),
    };
}

export async function teardownTestContext(ctx: TestContext | undefined): Promise<void> {
    if (!ctx) return;
    if (ctx.db) await ctx.db.dropDatabase().catch(() => {});
    if (ctx.mongoClient) await ctx.mongoClient.close().catch(() => {});
    if (ctx.moduleRef) await ctx.moduleRef.close().catch(() => {});
}
