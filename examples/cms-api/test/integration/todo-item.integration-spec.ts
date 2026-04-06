import { ObjectId } from 'mongodb';
import * as dto from '../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('TodoItem Integration Tests', () => {
    let ctx: TestContext;
    let todoListId: string;

    beforeAll(async () => {
        ctx = await createTestContext();

        // Create a todo list to hold items
        const res = await ctx.app.inject({
            method: 'POST',
            url: '/todo-lists',
            payload: {
                name: 'Item Test List',
                organization_id: ctx.testOrganizationId.toHexString(),
            } satisfies dto.CreateTodoListSchema,
        });
        expect(res.statusCode).toBe(201);
        todoListId = res.json()._id;
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('POST /todo-items', () => {
        it('should create a todo item and persist it in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: {
                    list_id: todoListId,
                    text: 'Buy milk',
                } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);

            const body = res.json<dto.TodoItemResponseSchema>();
            expect(body.text).toBe('Buy milk');
            expect(body.list_id).toBe(todoListId);
            expect(body._id).toBeDefined();
            expect(body.created_at).toBeDefined();

            // Verify directly in MongoDB
            const doc = await ctx.db.collection('todo-item').findOne({
                _id: new ObjectId(body._id),
            });
            expect(doc).not.toBeNull();
            expect(doc!.text).toBe('Buy milk');
            expect(doc!.list_id).toEqual(new ObjectId(todoListId));
        });

        it('should create a todo item with completed flag', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: {
                    list_id: todoListId,
                    text: 'Already done',
                    completed: true,
                } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);

            const body = res.json<dto.TodoItemResponseSchema>();
            expect(body.completed).toBe(true);

            const doc = await ctx.db.collection('todo-item').findOne({
                _id: new ObjectId(body._id),
            });
            expect(doc!.completed).toBe(true);
        });

        it('should return 404 when list_id does not exist', async () => {
            const fakeListId = new ObjectId().toHexString();
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: {
                    list_id: fakeListId,
                    text: 'Orphan item',
                } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /todo-items', () => {
        let itemId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: todoListId, text: 'GET test item' } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);
            itemId = res.json()._id;
        });

        it('should return all items for a list', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: '/todo-items',
                query: { list_id: todoListId },
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoItemListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBeGreaterThanOrEqual(1);
            expect(body.items.some((i) => i._id === itemId)).toBe(true);
        });

        it('should return items count matching MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: '/todo-items',
                query: { list_id: todoListId },
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoItemListResponseSchema>();
            const dbCount = await ctx.db.collection('todo-item').countDocuments({
                list_id: new ObjectId(todoListId),
            });
            expect(body.count).toBe(dbCount);
        });
    });

    describe('GET /todo-items/:itemId', () => {
        let itemId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: todoListId, text: 'Single fetch item' } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);
            itemId = res.json()._id;
        });

        it('should return a single todo item by id', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: `/todo-items/${itemId}` });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoItemResponseSchema>();
            expect(body._id).toBe(itemId);
            expect(body.text).toBe('Single fetch item');
        });

        it('should return 404 for a non-existent item id', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/todo-items/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /todo-items/:itemId', () => {
        let itemId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: todoListId, text: 'Before update' } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);
            itemId = res.json()._id;
        });

        it('should update the item text and reflect in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/todo-items/${itemId}`,
                payload: { text: 'After update' } satisfies dto.UpdateTodoItemSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoItemResponseSchema>();
            expect(body.text).toBe('After update');
            expect(body.updated_at).toBeDefined();

            const doc = await ctx.db.collection('todo-item').findOne({
                _id: new ObjectId(itemId),
            });
            expect(doc!.text).toBe('After update');
            expect(doc!.updated_at).toBeDefined();
        });

        it('should mark an item as completed', async () => {
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/todo-items/${itemId}`,
                payload: { completed: true } satisfies dto.UpdateTodoItemSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoItemResponseSchema>();
            expect(body.completed).toBe(true);

            const doc = await ctx.db.collection('todo-item').findOne({
                _id: new ObjectId(itemId),
            });
            expect(doc!.completed).toBe(true);
        });
    });

    describe('DELETE /todo-items/:itemId', () => {
        let itemId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: todoListId, text: 'To be deleted' } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);
            itemId = res.json()._id;
        });

        it('should delete the item and remove it from MongoDB', async () => {
            const res = await ctx.app.inject({ method: 'DELETE', url: `/todo-items/${itemId}` });
            expect(res.statusCode).toBe(200);

            const doc = await ctx.db.collection('todo-item').findOne({
                _id: new ObjectId(itemId),
            });
            expect(doc).toBeNull();
        });

        it('should have created audit records for the deleted item', async () => {
            const auditRecords = await ctx.db.collection('audit').find({
                entity_id: new ObjectId(itemId),
            }).toArray();
            expect(auditRecords.length).toBeGreaterThanOrEqual(1);

            const deleteAudit = auditRecords.find(a => a.action === 'delete');
            expect(deleteAudit).toBeDefined();
            expect(deleteAudit!.entity_type).toBe('todo-item');
        });
    });

    describe('Audit trail verification', () => {
        it('should create an audit record for every create operation', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: todoListId, text: 'Audit trail test' } satisfies dto.CreateTodoItemSchema,
            });
            expect(res.statusCode).toBe(201);

            const auditRecords = await ctx.db.collection('audit').find({
                entity_id: new ObjectId(res.json()._id),
                action: 'create',
            }).toArray();

            expect(auditRecords.length).toBe(1);
            expect(auditRecords[0].entity_type).toBe('todo-item');
            expect(auditRecords[0].context.principal_id).toEqual(ctx.testAccountId);
        });
    });
});
