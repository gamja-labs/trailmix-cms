import { ObjectId } from 'mongodb';
import { RevisionConflictError } from '../../../src';
import { InternalCollectionName } from '../../../src/constants';
import { TestCollectionName } from '../entities';
import { createTestContext, teardownTestContext, testAuditContext, TestContext } from '../setup';

/** Reads the revision trail for a given entity, oldest first. */
async function revisionFor(ctx: TestContext, entityId: ObjectId) {
    return ctx.db
        .collection(InternalCollectionName.Revision)
        .find({ entity_id: entityId })
        .sort({ created_at: 1 })
        .toArray();
}

describe('RevisableCollection (integration)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    it('insertOne creates a record at version 0 with a "create" revision (before=null)', async () => {
        const created = await ctx.gadgets.insertOne({ label: 'V0' }, testAuditContext);
        expect(created.version).toBe(0);

        const revisions = await revisionFor(ctx, created._id);
        expect(revisions).toHaveLength(1);
        expect(revisions[0].action).toBe('create');
        expect(revisions[0].before).toBeNull();
        expect(revisions[0].after).toMatchObject({ label: 'V0', version: 0 });
        expect(revisions[0].entity_type).toBe(TestCollectionName.Gadget);
    });

    it('findOneAndUpdate increments the version and records before/after', async () => {
        const created = await ctx.gadgets.insertOne({ label: 'before' }, testAuditContext);

        const updated = await ctx.gadgets.findOneAndUpdate(
            { _id: created._id },
            { $set: { label: 'after' } },
            created.version,
            testAuditContext,
        );

        expect(updated.label).toBe('after');
        expect(updated.version).toBe(1);
        expect(updated.updated_at).toBeInstanceOf(Date);

        const revisions = await revisionFor(ctx, created._id);
        expect(revisions.map((r) => r.action)).toEqual(['create', 'update']);
        const updateRevision = revisions[1];
        expect((updateRevision.before as { version: number }).version).toBe(0);
        expect((updateRevision.after as { version: number }).version).toBe(1);
        // A revision captures the originating query and update, not just the snapshots.
        expect((updateRevision.query as { _id: ObjectId })._id).toEqual(created._id);
        expect(updateRevision.update).toMatchObject({ $set: { label: 'after' } });
    });

    it('findOneAndUpdate throws RevisionConflictError on a stale version', async () => {
        const created = await ctx.gadgets.insertOne({ label: 'conflict' }, testAuditContext);

        // First update succeeds, bumping version to 1.
        await ctx.gadgets.findOneAndUpdate(
            { _id: created._id },
            { $set: { label: 'first' } },
            0,
            testAuditContext,
        );

        // Second update still passes the stale version 0 -> conflict.
        await expect(
            ctx.gadgets.findOneAndUpdate(
                { _id: created._id },
                { $set: { label: 'second' } },
                0,
                testAuditContext,
            ),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        // No extra revision record should have been written for the failed update.
        const revisions = await revisionFor(ctx, created._id);
        expect(revisions.map((r) => r.action)).toEqual(['create', 'update']);
    });

    it('deleteOne removes the record when the version matches and records a revision', async () => {
        const created = await ctx.gadgets.insertOne({ label: 'to-delete' }, testAuditContext);

        const result = await ctx.gadgets.deleteOne(created._id, created.version, testAuditContext);
        expect(result.deletedCount).toBe(1);
        expect(await ctx.gadgets.get(created._id)).toBeNull();

        const revisions = await revisionFor(ctx, created._id);
        expect(revisions.map((r) => r.action)).toEqual(['create', 'delete']);
        // The delete revision keeps the final state in `before` and nulls `after`.
        expect(revisions[1].before).toMatchObject({ label: 'to-delete', version: 0 });
        expect(revisions[1].after).toBeNull();
    });

    it('deleteOne throws RevisionConflictError on a stale version and keeps the record', async () => {
        const created = await ctx.gadgets.insertOne({ label: 'keep' }, testAuditContext);

        await expect(
            ctx.gadgets.deleteOne(created._id, created.version + 1, testAuditContext),
        ).rejects.toBeInstanceOf(RevisionConflictError);

        expect(await ctx.gadgets.get(created._id)).not.toBeNull();
    });
});
