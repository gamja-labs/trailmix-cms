import * as mongodb from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config';
import { Logger } from '@nestjs/common';

const logger = new Logger('ConnectionFactory');

/** DI token for the shared Mongo connection (`{ client, db }`). */
export const DB_CONNECTION = 'DB_CONNECTION';

/** The connection value provided under {@link DB_CONNECTION}. */
export type DatabaseConnection = {
    client: mongodb.MongoClient;
    db: mongodb.Db;
};

/** Options for {@link connectToDatabase}. */
export interface ConnectToDatabaseOptions {
    connectionString: string;
    databaseName: string;
}

/** Opens a Mongo connection. The returned `{ client, db }` can be shared so the app uses one pool. */
export async function connectToDatabase(options: ConnectToDatabaseOptions): Promise<DatabaseConnection> {
    const client = new mongodb.MongoClient(options.connectionString);
    logger.verbose('Connecting to mongodb...');
    await client.connect();
    logger.verbose('Connected to mongodb.');
    const db = client.db(options.databaseName, { ignoreUndefined: true });
    return { client, db };
}

/**
 * Inert connection for `GENERATE_SPEC` runs, which build the OpenAPI document without
 * querying Mongo. Collection providers resolve eagerly at startup, so the stub still
 * answers `db.collection(...)` and `client.startSession(...)` with no-ops.
 */
export function stubDatabase(): DatabaseConnection {
    const collection = () => ({
        createIndex: () => undefined,
        find: () => ({ toArray: async () => [] }),
        findOne: async () => null,
        insertOne: () => undefined,
        insertMany: () => undefined,
        updateOne: () => undefined,
        countDocuments: async () => 0,
    });

    return {
        client: {
            close: () => undefined,
            startSession: () => ({
                withTransaction: async (fn: () => Promise<unknown>) => fn(),
                endSession: () => undefined,
            }),
        } as unknown as mongodb.MongoClient,
        db: { collection } as unknown as mongodb.Db,
    };
}

/** Options for {@link createDatabaseConnection}. */
export interface CreateDatabaseConnectionOptions extends ConnectToDatabaseOptions {
    /** Return an inert {@link stubDatabase} instead of a real connection (for `GENERATE_SPEC` runs). */
    generateSpec?: boolean;
}

/** Returns a stub when `generateSpec` is set, otherwise a real connection — the one place that decision lives. */
export async function createDatabaseConnection(options: CreateDatabaseConnectionOptions): Promise<DatabaseConnection> {
    if (options.generateSpec) {
        return stubDatabase();
    }
    return connectToDatabase(options);
}

export const connectionFactory = {
    provide: DB_CONNECTION,
    inject: [ConfigService<AppConfig>],
    useFactory: (
        configService: ConfigService<AppConfig>
    ): Promise<DatabaseConnection> => createDatabaseConnection({
        generateSpec: configService.get('GENERATE_SPEC'),
        connectionString: configService.get('MONGODB_CONNECTION_STRING')!,
        databaseName: configService.get('MONGODB_DATABASE_NAME')!,
    }),
};
