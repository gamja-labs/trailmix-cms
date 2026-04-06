import { ObjectId } from 'mongodb';
import * as dto from '../../src/dto';
import { createTestContext, teardownTestContext, TestContext } from './setup';

describe('TodoList Integration Tests', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    afterAll(async () => {
        await teardownTestContext(ctx);
    });

    describe('POST /todo-lists', () => {
        it('should create a todo list and persist it in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: {
                    name: 'Shopping List',
                    organization_id: ctx.testOrganizationId.toHexString(),
                } satisfies dto.CreateTodoListSchema,
            });
            expect(res.statusCode).toBe(201);

            const body = res.json<dto.TodoListResponseSchema>();
            expect(body.name).toBe('Shopping List');
            expect(body.organization_id).toBe(ctx.testOrganizationId.toHexString());
            expect(body._id).toBeDefined();
            expect(body.created_at).toBeDefined();

            // Verify directly in MongoDB
            const doc = await ctx.db.collection('todo-list').findOne({
                _id: new ObjectId(body._id),
            });
            expect(doc).not.toBeNull();
            expect(doc!.name).toBe('Shopping List');
            expect(doc!.organization_id).toEqual(ctx.testOrganizationId);
        });

        it('should return 400 when organization_id is missing', async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: { name: 'No Org List' },
            });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /todo-lists', () => {
        let listId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: {
                    name: 'GET Test List',
                    organization_id: ctx.testOrganizationId.toHexString(),
                } satisfies dto.CreateTodoListSchema,
            });
            expect(res.statusCode).toBe(201);
            listId = res.json()._id;
        });

        it('should return all lists for an organization', async () => {
            const res = await ctx.app.inject({
                method: 'GET',
                url: '/todo-lists',
                query: { organization_id: ctx.testOrganizationId.toHexString() },
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoListListResponseSchema>();
            expect(body.items).toBeInstanceOf(Array);
            expect(body.count).toBeGreaterThanOrEqual(1);
            expect(body.items.some((l) => l._id === listId)).toBe(true);
        });

        it('should return 400 when organization_id is missing and user is not global admin', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: '/todo-lists' });
            expect(res.statusCode).toBe(400);
        });
    });

    describe('GET /todo-lists/:id', () => {
        let listId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: {
                    name: 'Single Fetch List',
                    organization_id: ctx.testOrganizationId.toHexString(),
                } satisfies dto.CreateTodoListSchema,
            });
            expect(res.statusCode).toBe(201);
            listId = res.json()._id;
        });

        it('should return a single todo list by id', async () => {
            const res = await ctx.app.inject({ method: 'GET', url: `/todo-lists/${listId}` });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoListResponseSchema>();
            expect(body._id).toBe(listId);
            expect(body.name).toBe('Single Fetch List');
        });

        it('should return 404 for a non-existent id', async () => {
            const fakeId = new ObjectId().toHexString();
            const res = await ctx.app.inject({ method: 'GET', url: `/todo-lists/${fakeId}` });
            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /todo-lists/:id', () => {
        let listId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: {
                    name: 'Before Update',
                    organization_id: ctx.testOrganizationId.toHexString(),
                } satisfies dto.CreateTodoListSchema,
            });
            expect(res.statusCode).toBe(201);
            listId = res.json()._id;
        });

        it('should update the todo list name and reflect in MongoDB', async () => {
            const res = await ctx.app.inject({
                method: 'PUT',
                url: `/todo-lists/${listId}`,
                payload: { name: 'After Update' } satisfies dto.UpdateTodoListSchema,
            });
            expect(res.statusCode).toBe(200);

            const body = res.json<dto.TodoListResponseSchema>();
            expect(body.name).toBe('After Update');
            expect(body.updated_at).toBeDefined();

            // Verify directly in MongoDB
            const doc = await ctx.db.collection('todo-list').findOne({
                _id: new ObjectId(listId),
            });
            expect(doc!.name).toBe('After Update');
            expect(doc!.updated_at).toBeDefined();
        });
    });

    describe('DELETE /todo-lists/:id', () => {
        let listId: string;

        beforeAll(async () => {
            const res = await ctx.app.inject({
                method: 'POST',
                url: '/todo-lists',
                payload: {
                    name: 'To Be Deleted',
                    organization_id: ctx.testOrganizationId.toHexString(),
                } satisfies dto.CreateTodoListSchema,
            });
            expect(res.statusCode).toBe(201);
            listId = res.json()._id;

            // Add some items to the list so we can verify cascade delete
            await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: listId, text: 'Cascade item 1' } satisfies dto.CreateTodoItemSchema,
            });
            await ctx.app.inject({
                method: 'POST',
                url: '/todo-items',
                payload: { list_id: listId, text: 'Cascade item 2' } satisfies dto.CreateTodoItemSchema,
            });
        });

        it('should delete the list and cascade delete its items', async () => {
            const res = await ctx.app.inject({ method: 'DELETE', url: `/todo-lists/${listId}` });
            expect(res.statusCode).toBe(200);

            // Verify the list is gone from MongoDB
            const listDoc = await ctx.db.collection('todo-list').findOne({
                _id: new ObjectId(listId),
            });
            expect(listDoc).toBeNull();

            // Verify all items for this list are also gone (cascade)
            const itemCount = await ctx.db.collection('todo-item').countDocuments({
                list_id: new ObjectId(listId),
            });
            expect(itemCount).toBe(0);
        });

        it('should create audit records for delete operations', async () => {
            const auditRecords = await ctx.db.collection('audit').find({
                entity_id: new ObjectId(listId),
            }).toArray();
            expect(auditRecords.length).toBeGreaterThanOrEqual(1);

            const deleteAudit = auditRecords.find(a => a.action === 'delete');
            expect(deleteAudit).toBeDefined();
        });
    });
});
