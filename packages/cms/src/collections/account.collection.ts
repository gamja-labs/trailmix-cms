import { Collection, OptionalUnlessRequiredId } from 'mongodb';
import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ZodType } from 'zod';
import { Account } from '@trailmix-cms/models';
import { Collections, DatabaseService, DocumentCollection, AuditedCollection } from '@trailmix-cms/db';

import { CMSCollectionName, PROVIDER_SYMBOLS } from '../constants';
import { type CollectionConfig } from '../types';

type Record = Account.Entity
const collectionName = CMSCollectionName.Account;

@Injectable()
export class AccountCollection<T extends Record = Record> extends AuditedCollection<T> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    protected readonly collectionName = collectionName;

    constructor(
        @Inject(PROVIDER_SYMBOLS.ACCOUNT_SCHEMA) protected readonly entitySchema: ZodType<OptionalUnlessRequiredId<T>>,
        @Inject(PROVIDER_SYMBOLS.ACCOUNT_CONFIG) protected readonly config: CollectionConfig,
        @Optional() @Inject(PROVIDER_SYMBOLS.ACCOUNT_SETUP) protected readonly setup: ((collection: Collection<T>) => Promise<void>) | null,
        @DocumentCollection(collectionName) collection: Collection<T>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection,
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        if (!this.config.disableDefaultIndexes) {
            await this.collection.createIndex({ user_id: 1 }, { unique: true, sparse: true });
        }
        if (this.setup) {
            await this.setup(this.collection);
        }
    }
}
