import { ClientSession, Collection, MongoServerError } from 'mongodb';
import { Injectable, Logger } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection, Utils } from '@trailmix-cms/db';
import { randomBytes } from 'crypto';
import * as trailmixModels from '@trailmix-cms/models';

import { ClerkCollectionName } from '../constants.js';

type Record = trailmixModels.ApiKey.Entity;
const collectionName = ClerkCollectionName.ApiKey;

/** API keys (unique `api_key`). Compatible with `@trailmix-cms/cms` (`api-key` collection). */
@Injectable()
export class ApiKeyCollection extends AuditedCollection<Record> {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = trailmixModels.ApiKey.schema;

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
        await this.collection.createIndex({ api_key: 1 }, { unique: true });
    }

    /**
     * Generates a new API key with the format: <prefix>_<random characters>
     */
    private static generateApiKey(prefix?: string, length: number = 32): string {
        const randomBytesBuffer = randomBytes(length);
        const randomString = randomBytesBuffer.toString('hex');
        return [prefix, randomString].filter(Boolean).join('_');
    }

    /**
     * Creates a new APIKey record with retry logic for duplicate API keys.
     * @throws Error if max retries exceeded or if insert fails for non-duplicate reasons
     */
    async create(
        params: Omit<Utils.Creatable<trailmixModels.ApiKey.Entity>, 'api_key'>,
        auditContext: trailmixModels.AuditContext.Model,
        options: { maxRetries: number, prefix?: string, length: number } = { maxRetries: 10, length: 32 },
        session?: ClientSession,
    ): Promise<Record> {
        const { maxRetries, prefix, length } = options;
        let attempts = 0;

        return this.databaseService.withTransaction({ session }, async (session) => {
            while (attempts < maxRetries) {
                try {
                    const apiKey = ApiKeyCollection.generateApiKey(prefix, length);
                    const doc: Omit<Record, '_id' | 'created_at' | 'updated_at'> = {
                        api_key: apiKey,
                        ...params,
                    };

                    const result = await this.insertOne(doc, auditContext);
                    this.logger.verbose(`Successfully created APIKey with id ${result._id} on attempt ${attempts + 1}`);
                    return result;
                } catch (error) {
                    if (error instanceof MongoServerError && error.code === 11000) {
                        attempts++;
                        this.logger.warn(`Duplicate API key detected on attempt ${attempts}, retrying with new key...`);
                        if (attempts >= maxRetries) {
                            this.logger.error(`Failed to create APIKey after ${maxRetries} attempts due to duplicate keys`);
                            throw new Error(`Failed to create APIKey: generated ${maxRetries} duplicate API keys. This is extremely unlikely.`);
                        }
                    } else {
                        this.logger.error(`Failed to create APIKey: ${error}`);
                        throw error;
                    }
                }
            }
            throw new Error('Unexpected error in create method');
        });
    }
}
