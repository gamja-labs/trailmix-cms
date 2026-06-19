import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Account } from '@trailmix-cms/models';
import { Collections, DatabaseService, DocumentCollection, AuditedCollection } from '@trailmix-cms/db';

import { ClerkCollectionName } from '../constants.js';

type Record = Account.Entity;
const collectionName = ClerkCollectionName.Account;

/**
 * Local account records for Clerk users — keyed by the Clerk `user_id`. The account `_id` (an
 * `ObjectId`) is the audit principal.
 *
 * **Wire-compatible with `@trailmix-cms/cms`**: same collection name (`account`), key field
 * (`user_id`), and `@trailmix-cms/models` `Account` schema, so a cms → core migration reads its
 * existing accounts unchanged.
 */
@Injectable()
export class AccountCollection extends AuditedCollection<Record> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = Account.schema;

    constructor(
        @DocumentCollection(collectionName) collection: Collection<Record>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection,
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`);
        await this.collection.createIndex({ user_id: 1 }, { unique: true, sparse: true });
    }
}
