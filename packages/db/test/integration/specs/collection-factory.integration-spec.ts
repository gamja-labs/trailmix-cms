import { InternalCollectionName } from '../../../src/constants';
import { TestCollectionName } from '../entities';
import { createTestContext, teardownTestContext, TestContext } from '../setup';

/** Returns the set of index key signatures (as JSON) for a collection. */
async function indexKeys(ctx: TestContext, collectionName: string): Promise<string[]> {
    const indexes = await ctx.db.collection(collectionName).indexes();
    return indexes.map((i) => JSON.stringify(i.key));
}

describe('collectionFactory indexing (integration)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    it('creates the default created_at / updated_at indexes for a collection', async () => {
        // Touch the collection so the lazily-created factory indexes exist.
        await ctx.widgets.insertOne({ name: 'index-probe', quantity: 1 });

        const keys = await indexKeys(ctx, TestCollectionName.Widget);
        expect(keys).toContain(JSON.stringify({ created_at: 1 }));
        expect(keys).toContain(JSON.stringify({ updated_at: 1 }));
    });

    it('marks the updated_at index as sparse', async () => {
        await ctx.widgets.insertOne({ name: 'index-probe-2', quantity: 1 });
        const indexes = await ctx.db.collection(TestCollectionName.Widget).indexes();
        const updatedAtIndex = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ updated_at: 1 }));
        expect(updatedAtIndex).toBeDefined();
        expect(updatedAtIndex!.sparse).toBe(true);
    });

    it('creates the audit collection custom indexes (from onModuleInit)', async () => {
        const keys = await indexKeys(ctx, InternalCollectionName.Audit);
        expect(keys).toContain(JSON.stringify({ entity_id: 1, created_at: 1 }));
        expect(keys).toContain(JSON.stringify({ entity_type: 1, created_at: 1 }));
        expect(keys).toContain(JSON.stringify({ account_id: 1, created_at: 1 }));
    });

    it('creates the revision collection custom indexes (from onModuleInit)', async () => {
        const keys = await indexKeys(ctx, InternalCollectionName.Revision);
        expect(keys).toContain(JSON.stringify({ entity_id: 1, created_at: 1 }));
        expect(keys).toContain(JSON.stringify({ entity_type: 1, created_at: 1 }));
    });
});
