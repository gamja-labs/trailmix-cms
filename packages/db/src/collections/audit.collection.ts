import { Filter, Collection, ClientSession, FindOptions, UpdateFilter } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Audit } from '@trailmix-cms/models';
import { DocumentCollection } from '../collection.decorator';
import { Creatable, ensureCreated } from '../utils';
import { InternalCollectionName } from '../constants';

type Record = Audit.Entity
const collectionName = InternalCollectionName.Audit;

@Injectable()
export class AuditCollection implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = Audit.schema;

    constructor(
        @DocumentCollection(collectionName) protected readonly collection: Collection<Record>
    ) { }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        await this.collection.createIndex({ entity_id: 1, created_at: 1 });
        await this.collection.createIndex({ entity_type: 1, created_at: 1 });
        await this.collection.createIndex({ account_id: 1, created_at: 1 });
    }

    find(filter: Filter<Record>, options?: FindOptions) {
        return this.collection.find(filter, options).toArray();
    };

    findOne(query: Filter<Record>) {
        return this.collection.findOne(query);
    };

    async insertOne(params: Creatable<Record>, session?: ClientSession) {
        const entity = ensureCreated<Audit.Entity>(params);
        const encoded = !!Audit.schema.encode(entity);
        if (!encoded) {
            throw new Error('Failed to encode audit record');
        }
        const { insertedId } = await this.collection.insertOne(entity, session);
        const result: Record = {
            ...entity,
            _id: insertedId
        }
        return result;
    };

    async findOneAndUpdate(query: Filter<Record>, update: UpdateFilter<Record>, session?: ClientSession) {
        return this.collection.findOneAndUpdate(query, update, { session, returnDocument: 'after' });
    }
} 