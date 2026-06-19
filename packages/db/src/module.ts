import { Provider } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { connectionFactory, DB_CONNECTION, type DatabaseConnection } from './connection.factory';
import { collectionServices } from './collections';
import { collectionFactory } from './collection.factory';
import { InternalCollectionName } from './constants';

export interface CreateDatabaseProvidersOptions {
    /**
     * Reuse an existing connection instead of opening one from env config, so the app shares a
     * single pool (e.g. with better-auth). When set, the `MONGODB_*` env vars are not read.
     */
    connection?: DatabaseConnection;
    /**
     * Don't register {@link DB_CONNECTION} at all — an imported module (e.g. `TrailmixCoreModule`)
     * already provides it. Takes precedence over {@link connection}.
     */
    externalConnection?: boolean;
}

export function createDatabaseProviders(options?: CreateDatabaseProvidersOptions): Provider[] {
    const providers: Provider[] = [
        DatabaseService,
        ...collectionServices,
        ...Object.values(InternalCollectionName).map(collectionName => collectionFactory(collectionName))
    ];

    if (options?.externalConnection) {
        return providers;
    }

    const connectionProvider: Provider = options?.connection
        ? { provide: DB_CONNECTION, useValue: options.connection }
        : connectionFactory;

    return [connectionProvider, ...providers];
}
