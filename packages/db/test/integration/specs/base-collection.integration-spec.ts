import { ObjectId } from 'mongodb';
import { TestCollectionName } from '../entities';
import { createTestContext, teardownTestContext, TestContext } from '../setup';

describe('BaseCollection (integration)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('insertOne', () => {
        it('inserts a document with a generated _id and created_at', async () => {
            const result = await ctx.widgets.insertOne({ name: 'Gizmo', quantity: 3 });

            expect(result._id).toBeInstanceOf(ObjectId);
            expect(result.created_at).toBeInstanceOf(Date);
            expect(result.name).toBe('Gizmo');
            expect(result.quantity).toBe(3);

            // Verify it actually landed in MongoDB.
            const doc = await ctx.db
                .collection(TestCollectionName.Widget)
                .findOne({ _id: result._id });
            expect(doc).not.toBeNull();
            expect(doc!.name).toBe('Gizmo');
            expect(doc!.created_at).toBeInstanceOf(Date);
        });

        it('rejects an entity that fails schema validation', async () => {
            await expect(
                // quantity must be a number — force an invalid value past the types.
                ctx.widgets.insertOne({ name: 'Bad', quantity: 'lots' as unknown as number }),
            ).rejects.toThrow();
        });
    });

    describe('get / findOne / find', () => {
        it('get() returns a document by ObjectId', async () => {
            const created = await ctx.widgets.insertOne({ name: 'Fetchable', quantity: 1 });
            const found = await ctx.widgets.get(created._id);
            expect(found).not.toBeNull();
            expect(found!._id).toEqual(created._id);
            expect(found!.name).toBe('Fetchable');
        });

        it('get() returns null for an unknown id', async () => {
            const found = await ctx.widgets.get(new ObjectId());
            expect(found).toBeNull();
        });

        it('findOne() returns a document matching a query', async () => {
            await ctx.widgets.insertOne({ name: 'Unique-Find-One', quantity: 9 });
            const found = await ctx.widgets.findOne({ name: 'Unique-Find-One' });
            expect(found).not.toBeNull();
            expect(found!.quantity).toBe(9);
        });

        it('find() returns all documents matching a query, honouring options', async () => {
            const tag = `batch_${new ObjectId().toHexString()}`;
            await ctx.widgets.insertOne({ name: tag, quantity: 1 });
            await ctx.widgets.insertOne({ name: tag, quantity: 2 });
            await ctx.widgets.insertOne({ name: tag, quantity: 3 });

            const all = await ctx.widgets.find({ name: tag });
            expect(all).toHaveLength(3);

            const limited = await ctx.widgets.find({ name: tag }, { limit: 2, sort: { quantity: 1 } });
            expect(limited).toHaveLength(2);
            expect(limited.map((w) => w.quantity)).toEqual([1, 2]);
        });
    });

    describe('findOneAndUpdate', () => {
        it('applies the update and stamps updated_at', async () => {
            const created = await ctx.widgets.insertOne({ name: 'Updatable', quantity: 1 });
            expect(created.updated_at).toBeUndefined();

            const updated = await ctx.widgets.findOneAndUpdate(
                { _id: created._id },
                { $set: { quantity: 42 } },
            );

            expect(updated.quantity).toBe(42);
            expect(updated.updated_at).toBeInstanceOf(Date);

            const doc = await ctx.db
                .collection(TestCollectionName.Widget)
                .findOne({ _id: created._id });
            expect(doc!.quantity).toBe(42);
            expect(doc!.updated_at).toBeInstanceOf(Date);
        });

        it('throws when no document matches the query', async () => {
            await expect(
                ctx.widgets.findOneAndUpdate({ _id: new ObjectId() }, { $set: { quantity: 1 } }),
            ).rejects.toThrow(/Failed to find and update/);
        });
    });

    describe('upsertOne', () => {
        it('inserts a new document, stamping created_at via $setOnInsert', async () => {
            const name = `upsert_${new ObjectId().toHexString()}`;
            const result = await ctx.widgets.upsertOne(
                { name },
                { $set: { quantity: 7 } },
            );
            expect(result.name).toBe(name);
            expect(result.quantity).toBe(7);
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('updates an existing document instead of inserting a duplicate', async () => {
            const name = `upsert_existing_${new ObjectId().toHexString()}`;
            const first = await ctx.widgets.upsertOne({ name }, { $set: { quantity: 1 } });
            const second = await ctx.widgets.upsertOne({ name }, { $set: { quantity: 2 } });

            expect(second._id).toEqual(first._id);
            expect(second.quantity).toBe(2);

            const count = await ctx.db
                .collection(TestCollectionName.Widget)
                .countDocuments({ name });
            expect(count).toBe(1);
        });
    });

    describe('deleteOne / deleteMany', () => {
        it('deleteOne removes a single document', async () => {
            const created = await ctx.widgets.insertOne({ name: 'Deletable', quantity: 1 });
            const result = await ctx.widgets.deleteOne(created._id);
            expect(result.deletedCount).toBe(1);
            expect(await ctx.widgets.get(created._id)).toBeNull();
        });

        it('deleteOne throws when nothing was deleted', async () => {
            await expect(ctx.widgets.deleteOne(new ObjectId())).rejects.toThrow(/Failed to delete/);
        });

        it('deleteMany removes every matching document', async () => {
            const tag = `del_batch_${new ObjectId().toHexString()}`;
            await ctx.widgets.insertOne({ name: tag, quantity: 1 });
            await ctx.widgets.insertOne({ name: tag, quantity: 2 });

            const result = await ctx.widgets.deleteMany({ name: tag });
            expect(result.deletedCount).toBe(2);

            const remaining = await ctx.widgets.find({ name: tag });
            expect(remaining).toHaveLength(0);
        });
    });
});
