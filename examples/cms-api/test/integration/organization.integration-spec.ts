import { ObjectId } from 'mongodb';
import * as dto from '../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('Organization Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('GET /organizations', () => {
        it('should return the seeded organization', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/organizations' });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.OrganizationListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBeGreaterThanOrEqual(1);

            const org = body.items.find(
                (o) => o._id === ctx.testOrganizationId.toHexString(),
            );
            expect(org).toBeDefined();
            expect(org!.name).toBe('Test Organization');
            expect(org!.description).toBe('Integration test organization');
        });
    });

    describe('GET /organizations/:id', () => {
        it('should return a single organization by id', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: `/organizations/${ctx.testOrganizationId.toHexString()}`,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.OrganizationResponseSchema>();
            expect(body._id).toBe(ctx.testOrganizationId.toHexString());
            expect(body.name).toBe('Test Organization');
            expect(body.description).toBe('Integration test organization');
            expect(body.created_at).toBeDefined();
        });

        it('should return 404 for a non-existent id', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/organizations/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /organizations/:id', () => {
        it('should update the organization name and reflect in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/organizations/${ctx.testOrganizationId.toHexString()}`,
                payload: { name: 'Updated Organization' } satisfies dto.UpdateOrganizationSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.OrganizationResponseSchema>();
            expect(body.name).toBe('Updated Organization');
            expect(body.updated_at).toBeDefined();

            // Verify directly in MongoDB
            const doc = await ctx.db.collection('organization').findOne({
                _id: ctx.testOrganizationId,
            });
            expect(doc!.name).toBe('Updated Organization');
            expect(doc!.updated_at).toBeDefined();
        });

        it('should create an audit record for the update', async () => {
            const auditRecords = await ctx.db.collection('audit').find({
                entity_id: ctx.testOrganizationId,
                action: 'update',
            }).toArray();
            expect(auditRecords.length).toBeGreaterThanOrEqual(1);
        });

        it('should allow partial updates', async () => {
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/organizations/${ctx.testOrganizationId.toHexString()}`,
                payload: { name: 'Partially Updated Org' } satisfies dto.UpdateOrganizationSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.OrganizationResponseSchema>();
            expect(body.name).toBe('Partially Updated Org');
        });
    });
});
