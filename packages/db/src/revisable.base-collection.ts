import { Filter, Collection, ClientSession, FindOptions, ObjectId, UpdateFilter, Document, OptionalUnlessRequiredId } from 'mongodb';
import { AuditContext, BaseEntity, Versioned, Revision } from '@trailmix-cms/models';
import { Creatable, ensureCreated, encodeOrThrow } from './utils';
import { InternalCollectionName } from './constants';
import { RevisionCollection } from './collections/revision.collection';
import { DatabaseService } from './database.service';
import { ZodType } from 'zod';
import merge from 'lodash.merge';

/**
 * Thrown when a write is attempted against a versioned record whose stored
 * version no longer matches the version the caller expected. Callers can map
 * this to an HTTP 409 Conflict.
 */
export class RevisionConflictError extends Error {
    constructor(
        public readonly collectionName: string,
        public readonly expectedVersion: number,
        public readonly actualVersion: number,
    ) {
        super(`Version conflict on "${collectionName}": expected version ${expectedVersion} but current version is ${actualVersion}`);
        this.name = 'RevisionConflictError';
    }
}

export abstract class RevisableCollection<T extends BaseEntity & Document & Versioned> {
    protected abstract readonly collectionName: InternalCollectionName | string;
    protected abstract readonly entitySchema: ZodType<OptionalUnlessRequiredId<T>>;

    constructor(
        protected readonly collection: Collection<T>,
        protected readonly databaseService: DatabaseService,
        protected readonly revisionCollection: RevisionCollection,
    ) { }

    get(id: ObjectId) {
        return this.collection.findOne({ _id: id } as Filter<T>);
    }

    find(filter: Filter<T>, options?: FindOptions) {
        return this.collection.find(filter, options).toArray();
    }

    findOne(query: Filter<T>) {
        return this.collection.findOne(query);
    }

    async insertOne(params: Creatable<Omit<T, 'version'>>, auditContext: AuditContext.Model, session?: ClientSession) {
        encodeOrThrow(AuditContext.schema, auditContext, 'Failed to encode audit context');
        return this.databaseService.withTransaction({ session }, async (session) => {
            const entity = ensureCreated({ ...params, version: 0 } as unknown as Creatable<T>) as OptionalUnlessRequiredId<T>;
            encodeOrThrow(this.entitySchema, entity, 'Failed to encode entity');
            const { insertedId } = await this.collection.insertOne(entity, { session });
            const result = {
                ...entity,
                _id: insertedId
            };
            const revisionRecord: Creatable<Revision.Entity> = {
                entity_id: insertedId,
                entity_type: this.collectionName,
                action: 'create',
                context: auditContext,
                before: null,
                after: result,
            };
            await this.revisionCollection.insertOne(revisionRecord, session);
            return result;
        });
    }

    /**
     * Finds a record matching `query`, verifies its version matches the
     * expected `version`, then applies `update` while automatically
     * incrementing the stored version by one. Throws {@link RevisionConflictError}
     * when the stored version does not match `version`.
     */
    async findOneAndUpdate(query: Filter<T>, update: UpdateFilter<T>, version: number, auditContext: AuditContext.Model, session?: ClientSession) {
        encodeOrThrow(AuditContext.schema, auditContext, 'Failed to encode audit context');
        return this.databaseService.withTransaction({ session }, async (session) => {
            const before = await this.collection.findOne(query, { session });
            if (!before) {
                throw new Error(`Failed to find and update "${this.collectionName}" with query ${JSON.stringify(query)}`);
            }
            if (before.version !== version) {
                throw new RevisionConflictError(this.collectionName, version, before.version);
            }
            const revisionUpdate = merge({}, update, {
                $set: {
                    updated_at: new Date(),
                } as Readonly<Partial<T>>,
                $inc: {
                    version: 1,
                },
            } as unknown as UpdateFilter<T>);
            // Keep the caller's original predicates on the write (not just _id),
            // plus the version CAS guard so the update only applies if unchanged.
            const after = await this.collection.findOneAndUpdate({ ...query, _id: before._id, version } as Filter<T>, revisionUpdate, {
                session,
                returnDocument: 'after'
            });
            if (!after) {
                // The version changed between the read and the write (concurrent
                // update); re-read to report the true current version.
                const current = await this.collection.findOne({ _id: before._id } as Filter<T>, { session });
                throw new RevisionConflictError(this.collectionName, version, current?.version ?? before.version);
            }
            const revisionRecord: Creatable<Revision.Entity> = {
                entity_id: after._id,
                entity_type: this.collectionName,
                action: 'update',
                context: auditContext,
                before,
                after,
                query,
                update,
            };
            await this.revisionCollection.insertOne(revisionRecord, session);
            return after;
        });
    }

    /**
     * Deletes the record identified by `entityId`, but only when its stored
     * version matches the expected `version`. Throws {@link RevisionConflictError}
     * when the stored version does not match `version`.
     */
    async deleteOne(entityId: ObjectId, version: number, auditContext: AuditContext.Model, session?: ClientSession) {
        encodeOrThrow(AuditContext.schema, auditContext, 'Failed to encode audit context');
        return this.databaseService.withTransaction({ session }, async (session) => {
            const before = await this.collection.findOne({ _id: entityId } as Filter<T>, { session });
            if (!before) {
                throw new Error(`Failed to delete "${this.collectionName}" with id ${entityId}`);
            }
            if (before.version !== version) {
                throw new RevisionConflictError(this.collectionName, version, before.version);
            }
            const query = { _id: entityId, version } as Filter<T>;
            const result = await this.collection.deleteOne(query, { session });
            if (result.deletedCount === 0) {
                // The version changed between the read and the write (concurrent
                // update); re-read to report the true current version.
                const current = await this.collection.findOne({ _id: entityId } as Filter<T>, { session });
                throw new RevisionConflictError(this.collectionName, version, current?.version ?? before.version);
            }
            const revisionRecord: Creatable<Revision.Entity> = {
                entity_id: entityId,
                entity_type: this.collectionName,
                action: 'delete',
                context: auditContext,
                before,
                after: null,
                query,
            };
            await this.revisionCollection.insertOne(revisionRecord, session);
            return result;
        });
    }
}
