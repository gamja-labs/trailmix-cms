import { Collection, ObjectId } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection } from '@trailmix-cms/db';
import { CMSCollectionName } from '../constants';
import * as trailmixModels from '@trailmix-cms/models';

type Record = trailmixModels.Role.Entity;
const collectionName = CMSCollectionName.Role;

@Injectable()
export class RoleCollection extends AuditedCollection<Record> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = trailmixModels.Role.schema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Record>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`);
        await this.collection.createIndex({ type: 1 });
        // Index for finding roles by organization
        await this.collection.createIndex({ type: 1, organization_id: 1 }, { sparse: true });
        // Index for finding roles by principal
        await this.collection.createIndex({ type: 1, principal_id: 1, principal_type: 1 });
        // Index for finding specific role assignments
        await this.collection.createIndex({ type: 1, principal_id: 1, principal_type: 1, organization_id: 1 }, { sparse: true });
        // Unique index to prevent duplicate organization role assignments 
        await this.collection.createIndex({ type: 1, principal_id: 1, principal_type: 1, organization_id: 1, role: 1 }, { unique: true, sparse: true });
        // Index for finding roles by organization and role name
        await this.collection.createIndex({ type: 1, organization_id: 1, role: 1 }, { sparse: true });
    }
}
