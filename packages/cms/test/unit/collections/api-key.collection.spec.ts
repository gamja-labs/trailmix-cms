import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Collection, MongoServerError, ClientSession } from 'mongodb';
import { faker } from '@faker-js/faker';

import * as trailmixModels from '@trailmix-cms/models';
import { DatabaseService, Collections } from '@trailmix-cms/db';
import { Utils } from '@trailmix-cms/db';

import * as TestUtils from '../../utils';
import { ApiKeyCollection } from '@/collections';
import { CMSCollectionName } from '@/constants';

describe('ApiKeyCollection', () => {
    let collection: ApiKeyCollection;
    let mongoCollection: jest.Mocked<Collection<trailmixModels.ApiKey.Entity>>;
    let databaseService: jest.Mocked<DatabaseService>;
    let auditCollection: jest.Mocked<Collections.AuditCollection>;

    beforeEach(async () => {
        // Mock Logger methods to prevent console output during tests
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation();

        const mockMongoCollection = {
            createIndex: jest.fn().mockResolvedValue('api_key_1'),
            insertOne: jest.fn(),
        };

        const mockSession = {} as ClientSession;
        const mockDatabaseService = {
            withTransaction: jest.fn((options, callback) => callback(mockSession)),
        };

        const mockAuditCollection = {
            insertOne: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApiKeyCollection,
                {
                    provide: Utils.buildCollectionToken(CMSCollectionName.ApiKey),
                    useValue: mockMongoCollection,
                },
                {
                    provide: DatabaseService,
                    useValue: mockDatabaseService,
                },
                {
                    provide: Collections.AuditCollection,
                    useValue: mockAuditCollection,
                },
            ],
        }).compile();

        collection = module.get<ApiKeyCollection>(ApiKeyCollection);
        mongoCollection = module.get(Utils.buildCollectionToken(CMSCollectionName.ApiKey));
        databaseService = module.get(DatabaseService);
        auditCollection = module.get(Collections.AuditCollection);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Restore Logger methods after all tests
        jest.restoreAllMocks();
    });

    describe('onModuleInit', () => {
        it('creates unique index on api_key field (ensuring API keys are unique)', async () => {
            await collection.onModuleInit();

            expect(mongoCollection.createIndex).toHaveBeenCalledWith(
                { api_key: 1 },
                { unique: true }
            );
            expect(Logger.prototype.verbose).toHaveBeenCalledWith(
                `creating custom indexes for collection_${CMSCollectionName.ApiKey}`
            );
        });
    });

    describe('create', () => {
        const accountEntity = TestUtils.Entities.createAccount();
        const auditContext = TestUtils.Models.createAuditContext({
            principal_id: accountEntity._id,
            principal_type: trailmixModels.Principal.Account,
        });

        it('creates API key successfully on first attempt (ensuring basic creation works)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            // Mock insertOne from AuditedCollection base class
            jest.spyOn(collection, 'insertOne' as any).mockResolvedValueOnce(createdApiKey);

            const result = await collection.create(params, auditContext);

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(collection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: params.name,
                    scope_type: params.scope_type,
                    scope_id: params.scope_id,
                    api_key: expect.stringMatching(/^[a-f0-9]{64}$/), // 32 bytes = 64 hex chars
                }),
                auditContext
            );
            expect(result).toEqual(createdApiKey);
            expect(Logger.prototype.verbose).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully created APIKey with id ${createdApiKey._id} on attempt 1`)
            );
        });

        it('creates API key with custom prefix (ensuring prefix is included in generated key)', async () => {
            const prefix = 'test_prefix';
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
                api_key: `${prefix}_${faker.string.alphanumeric(64)}`,
            });

            jest.spyOn(collection, 'insertOne' as any).mockResolvedValueOnce(createdApiKey);

            const result = await collection.create(params, auditContext, { prefix, maxRetries: 10, length: 32 });

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            // Verify that insertOne was called with a document containing the prefix
            expect(collection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: params.name,
                    scope_type: params.scope_type,
                    scope_id: params.scope_id,
                    api_key: expect.stringMatching(new RegExp(`^${prefix}_[a-f0-9]{64}$`)),
                }),
                auditContext
            );
            expect(result).toEqual(createdApiKey);
        });

        it('creates API key with custom length (ensuring custom length is respected)', async () => {
            const customLength = 16;
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            jest.spyOn(collection, 'insertOne' as any).mockResolvedValueOnce(createdApiKey);

            const result = await collection.create(params, auditContext, { maxRetries: 10, length: customLength });

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            // Verify that insertOne was called with a document containing the correct length API key
            expect(collection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: params.name,
                    scope_type: params.scope_type,
                    scope_id: params.scope_id,
                    api_key: expect.stringMatching(/^[a-f0-9]{32}$/), // 16 bytes = 32 hex chars
                }),
                auditContext
            );
            expect(result).toEqual(createdApiKey);
        });

        it('retries with new API key when duplicate key error occurs (ensuring retry logic handles duplicates within same transaction)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const duplicateError = new MongoServerError({ message: 'Duplicate key error' });
            duplicateError.code = 11000;

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            // Mock insertOne from AuditedCollection base class to fail first time with duplicate, then succeed
            // The retry happens within the same transaction callback
            jest.spyOn(collection, 'insertOne' as any)
                .mockImplementationOnce(() => Promise.reject(duplicateError))
                .mockImplementationOnce(() => Promise.resolve(createdApiKey));

            const result = await collection.create(params, auditContext, { maxRetries: 10, length: 32 });

            // Should only call withTransaction once - retries happen inside the callback
            expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(Logger.prototype.warn).toHaveBeenCalledWith(
                'Duplicate API key detected on attempt 1, retrying with new key...'
            );
            expect(Logger.prototype.verbose).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully created APIKey with id ${createdApiKey._id} on attempt 2`)
            );
            expect(result).toEqual(createdApiKey);
        });

        it('retries multiple times when duplicate key errors occur (ensuring multiple retries work within same transaction)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const duplicateError = new MongoServerError({ message: 'Duplicate key error' });
            duplicateError.code = 11000;

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            // Mock insertOne to fail twice with duplicate, then succeed
            // All retries happen within the same transaction callback
            jest.spyOn(collection, 'insertOne' as any)
                .mockImplementationOnce(() => Promise.reject(duplicateError))
                .mockImplementationOnce(() => Promise.reject(duplicateError))
                .mockImplementationOnce(() => Promise.resolve(createdApiKey));

            const result = await collection.create(params, auditContext, { maxRetries: 10, length: 32 });

            // Should only call withTransaction once - all retries happen inside the callback
            expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
            expect(Logger.prototype.warn).toHaveBeenNthCalledWith(1, 'Duplicate API key detected on attempt 1, retrying with new key...');
            expect(Logger.prototype.warn).toHaveBeenNthCalledWith(2, 'Duplicate API key detected on attempt 2, retrying with new key...');
            expect(Logger.prototype.verbose).toHaveBeenCalledWith(
                expect.stringContaining(`Successfully created APIKey with id ${createdApiKey._id} on attempt 3`)
            );
            expect(result).toEqual(createdApiKey);
        });

        it('throws error when max retries exceeded due to duplicate keys (ensuring max retries limit is enforced within transaction)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const duplicateError = new MongoServerError({ message: 'Duplicate key error' });
            duplicateError.code = 11000;

            const maxRetries = 3;
            // Mock insertOne to always fail with duplicate error
            jest.spyOn(collection, 'insertOne' as any).mockImplementation(() => Promise.reject(duplicateError));

            await expect(
                collection.create(params, auditContext, { maxRetries, length: 32 })
            ).rejects.toThrow(`Failed to create APIKey: generated ${maxRetries} duplicate API keys. This is extremely unlikely.`);

            // Should only call withTransaction once - all retries happen inside the callback
            expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(Logger.prototype.warn).toHaveBeenCalledTimes(maxRetries);
            expect(Logger.prototype.error).toHaveBeenCalledWith(
                `Failed to create APIKey after ${maxRetries} attempts due to duplicate keys`
            );
        });

        it('throws non-duplicate errors immediately without retrying (ensuring non-duplicate errors are not retried)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const otherError = new Error('Some other database error');
            // Mock insertOne to throw non-duplicate error
            jest.spyOn(collection, 'insertOne' as any).mockImplementationOnce(() => Promise.reject(otherError));

            await expect(
                collection.create(params, auditContext, { maxRetries: 10, length: 32 })
            ).rejects.toThrow('Some other database error');

            expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(Logger.prototype.warn).not.toHaveBeenCalled();
            expect(Logger.prototype.error).toHaveBeenCalledWith(`Failed to create APIKey: ${otherError}`);
        });

        it('throws non-duplicate MongoServerError immediately without retrying (ensuring only duplicate errors trigger retries)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const mongoError = new MongoServerError({ message: 'Some MongoDB error' });
            mongoError.code = 11001; // Different error code, not a duplicate key error

            // Mock insertOne to throw non-duplicate MongoServerError
            jest.spyOn(collection, 'insertOne' as any).mockImplementationOnce(() => Promise.reject(mongoError));

            await expect(
                collection.create(params, auditContext, { maxRetries: 10, length: 32 })
            ).rejects.toThrow(mongoError);

            expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(Logger.prototype.warn).not.toHaveBeenCalled();
            expect(Logger.prototype.error).toHaveBeenCalledWith(`Failed to create APIKey: ${mongoError}`);
        });

        it('uses default options when not provided (ensuring default values are used)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            jest.spyOn(collection, 'insertOne' as any).mockResolvedValueOnce(createdApiKey);

            const result = await collection.create(params, auditContext);

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
            expect(result).toEqual(createdApiKey);
        });

        it('passes session parameter to withTransaction when provided (ensuring session is correctly propagated)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            const createdApiKey = TestUtils.Entities.createApiKey({
                ...params,
            });

            const providedSession = {} as ClientSession;
            jest.spyOn(collection, 'insertOne' as any).mockResolvedValueOnce(createdApiKey);

            const result = await collection.create(params, auditContext, { maxRetries: 10, length: 32 }, providedSession);

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: providedSession },
                expect.any(Function)
            );
            expect(result).toEqual(createdApiKey);
        });

        it('throws unexpected error when maxRetries is 0 (ensuring fallback error path is covered)', async () => {
            const params: Omit<trailmixModels.ApiKey.Entity, '_id' | 'created_at' | 'updated_at' | 'api_key'> = {
                name: faker.word.noun(),
                scope_type: trailmixModels.ApiKeyScope.Account,
                scope_id: accountEntity._id,
            };

            // When maxRetries is 0, the while loop won't execute, and we'll hit the fallback error
            await expect(
                collection.create(params, auditContext, { maxRetries: 0, length: 32 })
            ).rejects.toThrow('Unexpected error in create method');

            expect(databaseService.withTransaction).toHaveBeenCalledWith(
                { session: undefined },
                expect.any(Function)
            );
        });
    });
});
