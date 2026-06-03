import { ObjectId } from 'mongodb';
import { InternalCollectionName } from '../../../src/constants';
import { TestCollectionName } from '../entities';
import { createTestContext, teardownTestContext, testAuditContext, TestContext } from '../setup';

/** Reads the audit trail for a given entity, newest first. */
async function auditFor(ctx: TestContext, entityId: ObjectId) {
    return ctx.db
        .collection(InternalCollectionName.Audit)
        .find({ entity_id: entityId })
        .sort({ created_at: 1 })
        .toArray();
}

describe('AuditedCollection (integration)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    it('insertOne writes a "create" audit record carrying the context', async () => {
        const created = await ctx.auditedWidgets.insertOne(
            { name: 'Audited Create', quantity: 1 },
            testAuditContext,
        );

        const audits = await auditFor(ctx, created._id);
        expect(audits).toHaveLength(1);
        expect(audits[0].action).toBe('create');
        expect(audits[0].entity_type).toBe(TestCollectionName.AuditedWidget);
        expect(audits[0].context).toMatchObject({ system: true, source: 'db-integration-tests' });
    });

    it('findOneAndUpdate writes an "update" audit record', async () => {
        const created = await ctx.auditedWidgets.insertOne(
            { name: 'Audited Update', quantity: 1 },
            testAuditContext,
        );

        const updated = await ctx.auditedWidgets.findOneAndUpdate(
            { _id: created._id },
            { $set: { quantity: 5 } },
            testAuditContext,
        );
        expect(updated.quantity).toBe(5);
        expect(updated.updated_at).toBeInstanceOf(Date);

        const audits = await auditFor(ctx, created._id);
        expect(audits.map((a) => a.action)).toEqual(['create', 'update']);
    });

    it('updateMany updates each document and writes one audit record per match', async () => {
        const tag = `audited_many_${new ObjectId().toHexString()}`;
        const a = await ctx.auditedWidgets.insertOne({ name: tag, quantity: 1 }, testAuditContext);
        const b = await ctx.auditedWidgets.insertOne({ name: tag, quantity: 1 }, testAuditContext);

        const result = await ctx.auditedWidgets.updateMany(
            { name: tag },
            { $set: { quantity: 99 } },
            testAuditContext,
        );
        expect(result.matchedCount).toBe(2);

        const docs = await ctx.auditedWidgets.find({ name: tag });
        expect(docs.every((d) => d.quantity === 99)).toBe(true);

        // Each entity should now have a create + update audit record.
        expect((await auditFor(ctx, a._id)).map((x) => x.action)).toEqual(['create', 'update']);
        expect((await auditFor(ctx, b._id)).map((x) => x.action)).toEqual(['create', 'update']);
    });

    it('deleteOne removes the document and writes a "delete" audit record', async () => {
        const created = await ctx.auditedWidgets.insertOne(
            { name: 'Audited Delete', quantity: 1 },
            testAuditContext,
        );

        const result = await ctx.auditedWidgets.deleteOne(created._id, testAuditContext);
        expect(result.deletedCount).toBe(1);
        expect(await ctx.auditedWidgets.get(created._id)).toBeNull();

        const audits = await auditFor(ctx, created._id);
        expect(audits.map((a) => a.action)).toEqual(['create', 'delete']);
    });

    it('deleteMany removes matches and writes a "delete" audit record for each', async () => {
        const tag = `audited_del_${new ObjectId().toHexString()}`;
        const a = await ctx.auditedWidgets.insertOne({ name: tag, quantity: 1 }, testAuditContext);
        const b = await ctx.auditedWidgets.insertOne({ name: tag, quantity: 1 }, testAuditContext);

        const result = await ctx.auditedWidgets.deleteMany({ name: tag }, testAuditContext);
        expect(result.deletedCount).toBe(2);

        expect((await auditFor(ctx, a._id)).map((x) => x.action)).toEqual(['create', 'delete']);
        expect((await auditFor(ctx, b._id)).map((x) => x.action)).toEqual(['create', 'delete']);
    });

    it('upsertOne writes an audit record', async () => {
        const name = `audited_upsert_${new ObjectId().toHexString()}`;
        const result = await ctx.auditedWidgets.upsertOne(
            { name },
            { $set: { quantity: 3 } },
            testAuditContext,
        );

        const audits = await auditFor(ctx, result._id);
        expect(audits).toHaveLength(1);
        expect(audits[0].action).toBe('update');
    });
});
