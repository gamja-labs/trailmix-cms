import { DatabaseService } from './database.service';
import { connectionFactory } from './connection.factory';
import { collectionServices } from './collections';
import { collectionFactory } from './collection.factory';
import { InternalCollectionName } from './constants';

export function createDatabaseProviders() {
    return [
        DatabaseService,
        connectionFactory,
        ...collectionServices,
        ...Object.values(InternalCollectionName).map(collectionName => collectionFactory(collectionName))
    ];
}