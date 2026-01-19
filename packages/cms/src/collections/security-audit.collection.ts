import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, BaseCollection } from '@trailmix-cms/db';
import { CMSCollectionName } from '../constants';
import * as trailmixModels from '@trailmix-cms/models';

type Record = trailmixModels.SecurityAudit.Entity;
const collectionName = CMSCollectionName.SecurityAudit;

@Injectable()
export class SecurityAuditCollection extends BaseCollection<Record> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = trailmixModels.SecurityAudit.schema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Record>,
        protected readonly databaseService: DatabaseService
    ) {
        super(collection, databaseService);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`);
        await this.collection.createIndex({ principal_id: 1, principal_type: 1, created_at: -1 });
        await this.collection.createIndex({ event_type: 1, created_at: -1 });
    }
}
