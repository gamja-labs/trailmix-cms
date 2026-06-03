import { ObjectId } from 'mongodb';
import * as dto from '../../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from '../setup';

/** Creates a note via the API and returns its response body. */
async function createNote(ctx: TestContext, payload: dto.CreateNoteSchema) {
    const res = await ctx.app.inject({ method: 'POST', url: '/notes', payload });
    expect(res.statusCode).toBe(201);
    return res.json<dto.NoteResponseSchema>();
}

describe('Note Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('POST /notes', () => {
        it('should create a note at version 0 and persist it in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/notes',
                payload: { title: 'First Note', body: 'Hello' } satisfies dto.CreateNoteSchema,
            });
            expect(res.statusCode).toBe(201);

            const body = res.json<dto.NoteResponseSchema>();
            expect(body.title).toBe('First Note');
            expect(body.body).toBe('Hello');
            expect(body.version).toBe(0);
            expect(body._id).toBeDefined();
            expect(body.created_at).toBeDefined();

            // Verify directly in MongoDB.
            const doc = await ctx.db.collection('note').findOne({ _id: new ObjectId(body._id) });
            expect(doc).not.toBeNull();
            expect(doc!.title).toBe('First Note');
            expect(doc!.version).toBe(0);
        });

        it('should write a "create" revision for the new note', async () => {
            const note = await createNote(ctx, { title: 'Revisioned Note' });

            const revisions = await ctx.db
                .collection('revision')
                .find({ entity_id: new ObjectId(note._id) })
                .toArray();
            expect(revisions).toHaveLength(1);
            expect(revisions[0].action).toBe('create');
            expect(revisions[0].entity_type).toBe('note');
            expect(revisions[0].before).toBeNull();
            expect(revisions[0].after).toMatchObject({ title: 'Revisioned Note', version: 0 });
        });

        it('should return 400 when title is missing', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/notes',
                payload: { body: 'no title' },
            });
            expect(res.statusCode).toBe(400);
        });

        it('should return 400 when title is empty', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/notes',
                payload: { title: '' } satisfies dto.CreateNoteSchema,
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /notes', () => {
        it('should return all notes with a count', async () => {
            await createNote(ctx, { title: 'Listable Note' });

            const res = await ctx.app.inject({ method: 'GET', url: '/notes' });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.NoteListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBe(body.items.length);
            expect(body.count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /notes/:noteId', () => {
        it('should return a single note by id', async () => {
            const note = await createNote(ctx, { title: 'Single Note' });

            const res = await ctx.app.inject({ method: 'GET', url: `/notes/${note._id}` });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.NoteResponseSchema>();
            expect(body._id).toBe(note._id);
            expect(body.title).toBe('Single Note');
        });

        it('should return 404 for a non-existent id', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/notes/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /notes/:noteId', () => {
        it('should update a note and increment its version when the version matches', async () => {
            const note = await createNote(ctx, { title: 'Editable', body: 'v0' });

            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${note._id}`,
                payload: { body: 'v1', version: note.version } satisfies dto.UpdateNoteSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.NoteResponseSchema>();
            expect(body.body).toBe('v1');
            expect(body.version).toBe(1);
            expect(body.updated_at).toBeDefined();

            // Verify directly in MongoDB.
            const doc = await ctx.db.collection('note').findOne({ _id: new ObjectId(note._id) });
            expect(doc!.body).toBe('v1');
            expect(doc!.version).toBe(1);
        });

        it('should return 409 when the supplied version is stale', async () => {
            const note = await createNote(ctx, { title: 'Conflict', body: 'v0' });

            // First update succeeds (version 0 -> 1).
            const ok = await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${note._id}`,
                payload: { body: 'v1', version: 0 } satisfies dto.UpdateNoteSchema,
            });
            expect(ok.statusCode).toBe(200);

            // Second update reuses the now-stale version 0 -> 409.
            const conflict = await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${note._id}`,
                payload: { body: 'v2', version: 0 } satisfies dto.UpdateNoteSchema,
            });
            expect(conflict.statusCode).toBe(409);

            // The stale write must not have taken effect.
            const doc = await ctx.db.collection('note').findOne({ _id: new ObjectId(note._id) });
            expect(doc!.body).toBe('v1');
            expect(doc!.version).toBe(1);
        });

        it('should return 404 when updating a non-existent note', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${fakeId}`,
                payload: { body: 'x', version: 0 } satisfies dto.UpdateNoteSchema,
            });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('DELETE /notes/:noteId', () => {
        it('should delete a note when the version matches', async () => {
            const note = await createNote(ctx, { title: 'To Delete' });

            const res = await ctx.app.inject({
                method: 'DELETE',
                url: `/notes/${note._id}`,
                query: { version: String(note.version) },
            });
            expect(res.statusCode).toBe(200);

            const doc = await ctx.db.collection('note').findOne({ _id: new ObjectId(note._id) });
            expect(doc).toBeNull();
        });

        it('should return 409 when deleting with a stale version and keep the note', async () => {
            const note = await createNote(ctx, { title: 'Keep On Conflict' });
            // Bump the version so the original (0) is stale.
            await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${note._id}`,
                payload: { body: 'bumped', version: 0 } satisfies dto.UpdateNoteSchema,
            });

            const res = await ctx.app.inject({
                method: 'DELETE',
                url: `/notes/${note._id}`,
                query: { version: '0' },
            });
            expect(res.statusCode).toBe(409);

            const doc = await ctx.db.collection('note').findOne({ _id: new ObjectId(note._id) });
            expect(doc).not.toBeNull();
        });
    });

    describe('GET /notes/:noteId/revisions', () => {
        it('should return the full revision history newest-first', async () => {
            const note = await createNote(ctx, { title: 'Tracked', body: 'v0' });
            await ctx.app.inject({
                method: 'PUT',
                url: `/notes/${note._id}`,
                payload: { body: 'v1', version: 0 } satisfies dto.UpdateNoteSchema,
            });

            const res = await ctx.app.inject({ method: 'GET', url: `/notes/${note._id}/revisions` });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.RevisionListResponseSchema>();
            expect(body.count).toBe(2);
            // Newest-first: the update revision precedes the create revision.
            expect(body.items.map((r) => r.action)).toEqual(['update', 'create']);
            expect(body.items.every((r) => r.entity_type === 'note')).toBe(true);

            const [updateRevision, createRevision] = body.items;
            expect(createRevision.before).toBeNull();
            expect((updateRevision.before as { version: number }).version).toBe(0);
            expect((updateRevision.after as { version: number }).version).toBe(1);
        });

        it('should return 404 for revisions of a non-existent note', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/notes/${fakeId}/revisions` });
            expect(res.statusCode).toBe(404);
        });
    });
});
