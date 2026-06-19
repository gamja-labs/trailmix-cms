import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection } from '@trailmix-cms/db';
import * as trailmixModels from '@trailmix-cms/models';

import { ClerkCollectionName } from '../constants.js';

type Record = trailmixModels.Organization.Entity;
const collectionName = ClerkCollectionName.Organization;

/** Organizations (multi-tenant). Wire-compatible with `@trailmix-cms/cms` (`organization` collection). */
@Injectable()
export class OrganizationCollection extends AuditedCollection<Record> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = trailmixModels.Organization.schema;

    constructor(
        @DocumentCollection(collectionName) collection: Collection<Record>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection,
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`);
    }
}
