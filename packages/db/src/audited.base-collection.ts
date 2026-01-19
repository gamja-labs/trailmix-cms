import { Filter, Collection, ClientSession, FindOptions, ObjectId, UpdateFilter, Document, WithId, OptionalUnlessRequiredId, FindOneAndUpdateOptions } from 'mongodb';
import { Audit, AuditContext, BaseEntity } from '@trailmix-cms/models';
import { Creatable, ensureCreated } from './utils';
import { InternalCollectionName } from './constants';
import { AuditCollection } from './collections/audit.collection';
import { DatabaseService } from './database.service';
import { ZodType } from 'zod';
import merge from 'lodash.merge';

export abstract class AuditedCollection<T extends BaseEntity & Document> {
    protected abstract readonly collectionName: InternalCollectionName | string;
    protected abstract readonly entitySchema: ZodType<OptionalUnlessRequiredId<T>>;

    constructor(
        protected readonly collection: Collection<T>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: AuditCollection
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

    async findOneAndUpdate(query: Filter<T>, update: UpdateFilter<T>, auditContext: AuditContext.Model, session?: ClientSession) {
        const encoded = !!AuditContext.schema.encode(auditContext);
        if (!encoded) {
            throw new Error('Failed to encode audit context');
        }
        return this.databaseService.withTransaction({ session }, async (session) => {
            const result = await this.collection.findOneAndUpdate(query, merge(update, {
                $set: {
                    updated_at: new Date(),
                } as Readonly<Partial<T>>
            }), {
                session,
                returnDocument: 'after'
            });
            if (!result) {
                throw new Error(`Failed to find and update "${this.collectionName}" with query ${JSON.stringify(query)}`);
            }
            const auditRecord: Creatable<Audit.Entity> = {
                entity_id: result._id,
                entity_type: this.collectionName,
                action: 'update',
                context: auditContext,
            };
            await this.auditCollection.insertOne(auditRecord, session);
            return result;
        });
    }

    async deleteMany(query: Filter<T>, auditContext: AuditContext.Model, session?: ClientSession) {
        const encoded = !!AuditContext.schema.encode(auditContext);
        if (!encoded) {
            throw new Error('Failed to encode audit context');
        }
        return this.databaseService.withTransaction({ session }, async (session) => {
            const items = await this.collection.find(query, { session }).toArray();
            const result = await this.collection.deleteMany({ _id: { $in: items.map(item => item._id) } } as Filter<T>, { session });
            if (result.deletedCount !== items.length) {
                throw new Error(`Failed to delete ${items.length} of ${items.length} "${this.collectionName}" items with query ${JSON.stringify(query)}`);
            }
            for (const item of items) {
                const auditRecord: Creatable<Audit.Entity> = {
                    entity_id: item._id,
                    entity_type: this.collectionName,
                    action: 'delete',
                    context: auditContext,
                };
                await this.auditCollection.insertOne(auditRecord, session);
            }
            return result;
        });
    }

    async deleteOne(entityId: ObjectId, auditContext: AuditContext.Model, session?: ClientSession) {
        const encoded = !!AuditContext.schema.encode(auditContext);
        if (!encoded) {
            throw new Error('Failed to encode audit context');
        }
        return this.databaseService.withTransaction({ session }, async (session) => {
            const result = await this.collection.deleteOne({ _id: entityId } as Filter<T>, { session });
            if (result.deletedCount === 0) {
                throw new Error(`Failed to delete "${this.collectionName}" with id ${entityId}`);
            }
            const auditRecord: Creatable<Audit.Entity> = {
                entity_id: entityId,
                entity_type: this.collectionName,
                action: 'delete',
                context: auditContext,
            };
            await this.auditCollection.insertOne(auditRecord, session);
            return result;
        });
    }

    async insertOne(params: Creatable<T>, auditContext: AuditContext.Model, session?: ClientSession) {
        const encoded = !!AuditContext.schema.encode(auditContext);
        if (!encoded) {
            throw new Error('Failed to encode audit context');
        }
        return this.databaseService.withTransaction({ session }, async (session) => {
            const entity = ensureCreated(params) as OptionalUnlessRequiredId<T>;
            const encoded = !!this.entitySchema.encode(entity);
            if (!encoded) {
                throw new Error('Failed to encode entity');
            }
            const { insertedId } = await this.collection.insertOne(entity, session);
            const result = {
                ...entity,
                _id: insertedId
            };
            const auditRecord: Creatable<Audit.Entity> = {
                entity_id: insertedId,
                entity_type: this.collectionName,
                action: 'create',
                context: auditContext,
            };
            await this.auditCollection.insertOne(auditRecord, session);
            return result;
        });
    }

    async upsertOne(query: Filter<T>, update: UpdateFilter<T>, auditContext: AuditContext.Model, session?: ClientSession) {
        const encoded = !!AuditContext.schema.encode(auditContext);
        if (!encoded) {
            throw new Error('Failed to encode audit context');
        }
        return this.databaseService.withTransaction({ session }, async (session) => {
            const updateFilter: UpdateFilter<T> =
                merge(update, {
                    $setOnInsert: {
                        created_at: new Date(),
                    } as Readonly<Partial<T>>
                });
            const result = await this.collection.findOneAndUpdate(query, updateFilter, { upsert: true, session, returnDocument: 'after' })!;
            if (!result) {
                throw new Error('Failed to upsert record');
            }
            const auditRecord: Creatable<Audit.Entity> = {
                entity_id: result._id,
                entity_type: this.collectionName,
                action: 'update',
                context: auditContext,
            };
            await this.auditCollection.insertOne(auditRecord, session);
            return result;
        });
    }
} 