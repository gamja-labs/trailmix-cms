import { AuditCollection } from './audit.collection';
import { RevisionCollection } from './revision.collection';
import { collectionFactory } from '../collection.factory';
import { InternalCollectionName } from '../constants';

export { AuditCollection } from './audit.collection';
export { RevisionCollection } from './revision.collection';

export const collectionServices = [
    AuditCollection,
    RevisionCollection,
];

export const mongoDbCollectionProviders = [
    collectionFactory(InternalCollectionName.Audit),
    collectionFactory(InternalCollectionName.Revision),
];
