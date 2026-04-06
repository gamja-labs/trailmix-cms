import { ObjectId } from 'mongodb';
import { Dto } from '@trailmix-cms/cms';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('ApiKey Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('POST /api-keys (account-scoped)', () => {
        it('should create an account-scoped API key', async () => {
            const body: Dto.CreateApiKeySchema = {
                name: 'Test Account Key',
                scope_type: 'account',
                scope_id: ctx.testAccountId.toHexString(),
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(201);

            const created = res.json<Dto.ApiKeyResponseSchema>();
            expect(created._id).toBeDefined();
            expect(created.api_key).toBeDefined();
            expect(created.name).toBe('Test Account Key');
            expect(created.scope_type).toBe('account');
            expect(created.created_at).toBeDefined();

            // Verify directly in MongoDB
            const doc = await ctx.db.collection('api-key').findOne({
                _id: new ObjectId(created._id),
            });
            expect(doc).not.toBeNull();
            expect(doc!.api_key).toBe(created.api_key);
            expect(doc!.name).toBe('Test Account Key');
        });

        it('should reject account-scoped key without scope_id', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/api-keys',
                payload: {
                    name: 'Missing Scope ID',
                    scope_type: 'account',
                } satisfies Partial<Dto.CreateApiKeySchema>,
            });
            expect(res.statusCode).toBe(400);
        });

        it('should reject account-scoped key for a different account', async () => {
            const otherAccountId = new ObjectId().toHexString();
            const body: Dto.CreateApiKeySchema = {
                name: 'Other Account Key',
                scope_type: 'account',
                scope_id: otherAccountId,
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api-keys (organization-scoped)', () => {
        it('should create an organization-scoped API key', async () => {
            const body: Dto.CreateApiKeySchema = {
                name: 'Test Org Key',
                scope_type: 'organization',
                scope_id: ctx.testOrganizationId.toHexString(),
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(201);

            const created = res.json<Dto.ApiKeyResponseSchema>();
            expect(created._id).toBeDefined();
            expect(created.api_key).toBeDefined();
            expect(created.name).toBe('Test Org Key');
            expect(created.scope_type).toBe('organization');
            expect(created.created_at).toBeDefined();

            // Verify in MongoDB
            const doc = await ctx.db.collection('api-key').findOne({
                _id: new ObjectId(created._id),
            });
            expect(doc).not.toBeNull();
            expect(doc!.scope_type).toBe('organization');
        });

        it('should reject org-scoped key without scope_id', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/api-keys',
                payload: {
                    name: 'No Scope ID Org Key',
                    scope_type: 'organization',
                } satisfies Partial<Dto.CreateApiKeySchema>,
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api-keys (global-scoped)', () => {
        it('should reject global-scoped key for non-admin user', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/api-keys',
                payload: {
                    name: 'Global Key',
                    scope_type: 'global',
                } satisfies Partial<Dto.CreateApiKeySchema>,
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /api-keys', () => {
        let accountKeyId: string;

        beforeAll(async () => {
            const body: Dto.CreateApiKeySchema = {
                name: 'List Test Key',
                scope_type: 'account',
                scope_id: ctx.testAccountId.toHexString(),
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(201);
            accountKeyId = res.json()._id;
        });

        it('should list account-scoped API keys', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: '/api-keys',
                query: { scope_type: 'account' },
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<Dto.ApiKeyListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBeGreaterThanOrEqual(1);
            expect(body.items.some((k) => k._id === accountKeyId)).toBe(true);
        });

        it('should list organization-scoped API keys', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: '/api-keys',
                query: {
                    scope_type: 'organization',
                    scope_id: ctx.testOrganizationId.toHexString(),
                },
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<Dto.ApiKeyListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBeGreaterThanOrEqual(1);
        });

        it('should require scope_type for non-admin users', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/api-keys' });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /api-keys/:id', () => {
        let apiKeyId: string;

        beforeAll(async () => {
            const body: Dto.CreateApiKeySchema = {
                name: 'Fetch Test Key',
                scope_type: 'account',
                scope_id: ctx.testAccountId.toHexString(),
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(201);
            apiKeyId = res.json()._id;
        });

        it('should return a single API key by id', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: `/api-keys/${apiKeyId}` });
            expect(res.statusCode).toBe(200);

            const body = res.json<Dto.ApiKeyResponseSchema>();
            expect(body._id).toBe(apiKeyId);
            expect(body.name).toBe('Fetch Test Key');
            expect(body.api_key).toBeDefined();
        });

        it('should return 404 for a non-existent id', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/api-keys/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /api-keys/:id', () => {
        let apiKeyId: string;

        beforeAll(async () => {
            const body: Dto.CreateApiKeySchema = {
                name: 'Delete Test Key',
                scope_type: 'account',
                scope_id: ctx.testAccountId.toHexString(),
            };

            const res = await ctx.app.inject({ method: 'POST', url: '/api-keys', payload: body });
            expect(res.statusCode).toBe(201);
            apiKeyId = res.json()._id;
        });

        it('should delete an API key', async () => {
            const res = await ctx.app.inject({ method: 'DELETE', url: `/api-keys/${apiKeyId}` });
            expect(res.statusCode).toBe(200);

            // Verify removed from MongoDB
            const doc = await ctx.db.collection('api-key').findOne({
                _id: new ObjectId(apiKeyId),
            });
            expect(doc).toBeNull();
        });

        it('should create an audit record for the deletion', async () => {
            const auditRecords = await ctx.db.collection('audit').find({
                entity_id: new ObjectId(apiKeyId),
                action: 'delete',
            }).toArray();
            expect(auditRecords.length).toBeGreaterThanOrEqual(1);
        });

        it('should return 404 when deleting a non-existent key', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'DELETE', url: `/api-keys/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });
});
