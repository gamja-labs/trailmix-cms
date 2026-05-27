import * as mongodb from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config';
import { Logger } from '@nestjs/common';

const logger = new Logger('ConnectionFactory');

export const connectionFactory = {
    provide: 'DB_CONNECTION',
    inject: [ConfigService<AppConfig>],
    useFactory: async (
        configService: ConfigService<AppConfig>
    ) => {
        if (configService.get('GENERATE_SPEC')) {
            const mockedConnection: {
                client: mongodb.MongoClient,
                db: mongodb.Db
            } = {
                client: {
                    close: () => { },
                    startSession: () => ({
                        withTransaction: async (fn: () => Promise<unknown>) => fn(),
                        endSession: () => { },
                    }),
                },
                db: {
                    collection: () => ({
                        createIndex: () => { },
                        find: () => ({ toArray: async () => [] }),
                        findOne: () => ({}),
                        insertOne: () => { },
                        updateOne: () => { },
                        countDocuments: () => 0,
                        insertMany: () => { },
                    }),
                }
            } as any;
            return mockedConnection;
        }
        
        const connectionString = configService.get('MONGODB_CONNECTION_STRING');
        const databaseName = configService.get('MONGODB_DATABASE_NAME');
        
        const client = new mongodb.MongoClient(connectionString);
        logger.verbose('Connecting to mongodb...');
        await client.connect();
        logger.verbose('Connected to mongodb.');
        const db = client.db(databaseName, { ignoreUndefined: true });
        return { client, db };
    },
};