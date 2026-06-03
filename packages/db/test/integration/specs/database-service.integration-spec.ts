import { ObjectId } from 'mongodb';
import { InternalCollectionName } from '../../../src/constants';
import { createTestContext, teardownTestContext, testAuditContext, TestContext } from '../setup';

describe('DatabaseService transactions (integration)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    it('startSession returns a usable client session', async () => {
        const session = ctx.databaseService.startSession();
        expect(session).toBeDefined();
        await session.endSession();
    });

    it('withTransaction returns the callback result and reuses a provided session', async () => {
        const session = ctx.databaseService.startSession();
        try {
            const value = await ctx.databaseService.withTransaction({ session }, async (s) => {
                expect(s).toBe(session);
                return 'ok';
            });
            expect(value).toBe('ok');
        } finally {
            await session.endSession();
        }
    });

    it('commits every write performed inside a successful transaction', async () => {
        const tag = `txn_commit_${new ObjectId().toHexString()}`;
        const session = ctx.databaseService.startSession();
        await session.withTransaction(async () => {
            await ctx.widgets.insertOne({ name: tag, quantity: 1 }, session);
            await ctx.widgets.insertOne({ name: tag, quantity: 2 }, session);
        });
        await session.endSession();

        expect(await ctx.widgets.find({ name: tag })).toHaveLength(2);
    });

    it('rolls back every write when the transaction throws', async () => {
        const tag = `txn_rollback_${new ObjectId().toHexString()}`;
        const session = ctx.databaseService.startSession();
        try {
            await expect(
                session.withTransaction(async () => {
                    await ctx.widgets.insertOne({ name: tag, quantity: 1 }, session);
                    await ctx.widgets.insertOne({ name: tag, quantity: 2 }, session);
                    throw new Error('boom');
                }),
            ).rejects.toThrow('boom');
        } finally {
            await session.endSession();
        }

        // Nothing should have been committed.
        expect(await ctx.widgets.find({ name: tag })).toHaveLength(0);
    });

    it('rolls back both the entity update and its audit record together on failure', async () => {
        // Commit an entity first, then attempt an audited update that throws.
        const created = await ctx.auditedWidgets.insertOne(
            { name: 'txn-cross-collection', quantity: 1 },
            testAuditContext,
        );
        const auditsBefore = await ctx.db
            .collection(InternalCollectionName.Audit)
            .countDocuments({ entity_id: created._id });

        const session = ctx.databaseService.startSession();
        try {
            await expect(
                session.withTransaction(async () => {
                    await ctx.auditedWidgets.findOneAndUpdate(
                        { _id: created._id },
                        { $set: { quantity: 2 } },
                        testAuditContext,
                        session,
                    );
                    throw new Error('boom');
                }),
            ).rejects.toThrow('boom');
        } finally {
            await session.endSession();
        }

        // The entity write rolled back...
        const doc = await ctx.auditedWidgets.get(created._id);
        expect(doc!.quantity).toBe(1);
        // ...and so did the audit record that the update would have emitted.
        const auditsAfter = await ctx.db
            .collection(InternalCollectionName.Audit)
            .countDocuments({ entity_id: created._id });
        expect(auditsAfter).toBe(auditsBefore);
    });
});
