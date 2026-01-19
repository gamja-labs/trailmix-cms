import { Collection, OptionalUnlessRequiredId } from 'mongodb';
import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection } from '@trailmix-cms/db';
import { CMSCollectionName, PROVIDER_SYMBOLS } from '../constants';
import * as trailmixModels from '@trailmix-cms/models';
import { ZodType } from 'zod';
import { type CollectionConfig } from '../types';

type Record = trailmixModels.Organization.Entity;
const collectionName = CMSCollectionName.Organization;

@Injectable()
export class OrganizationCollection<T extends Record = Record> extends AuditedCollection<T> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;

    constructor(
        @Inject(PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA) protected readonly entitySchema: ZodType<OptionalUnlessRequiredId<T>>,
        @Optional() @Inject(PROVIDER_SYMBOLS.ORGANIZATION_SETUP) protected readonly setup: ((collection: Collection<T>) => Promise<void>) | null,
        @Inject(PROVIDER_SYMBOLS.ORGANIZATION_CONFIG) protected readonly config: CollectionConfig,
        @DocumentCollection(collectionName) collection: Collection<T>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`);
        if (!this.config.disableDefaultIndexes) {
            // await this.collection.createIndex({ name: 1 });
        }
        if (this.setup) {
            await this.setup(this.collection);
        }
    }
}
