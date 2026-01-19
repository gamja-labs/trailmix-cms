import { Injectable } from '@nestjs/common';
import { ObjectId, ClientSession } from 'mongodb';
import { OrganizationDeleteHook } from '@trailmix-cms/cms';
import * as trailmixModels from '@trailmix-cms/models';
import { TodoListCollection } from '../collections/todo-list.collection';
import { TodoItemCollection } from '../collections/todo-item.collection';

/**
 * Example organization delete hook that cascades deletion to todo lists and todo items.
 * This hook runs within the same transaction as the organization deletion,
 * ensuring atomicity - if any deletion fails, the entire operation is rolled back.
 */
@Injectable()
export class AppOrganizationDeleteHook implements OrganizationDeleteHook {

    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoItemCollection: TodoItemCollection,
    ) {}

    async onHook(
        organizationId: ObjectId,
        organization: trailmixModels.Organization.Entity,
        auditContext: trailmixModels.AuditContext.Model,
        session: ClientSession
    ): Promise<void> {
        // Find all todo lists for this organization (using the transaction session)
        // Access the protected collection property via type assertion to use the session
        const todoLists = await (this.todoListCollection as any).collection.find(
            { organization_id: organizationId } as any,
            { session }
        ).toArray();

        // Delete all todo items for each todo list (within the transaction)
        for (const todoList of todoLists) {
            await this.todoItemCollection.deleteMany(
                { list_id: todoList._id } as any,
                auditContext,
                session
            );
        }

        // Delete all todo lists for this organization (within the transaction)
        await this.todoListCollection.deleteMany(
            { organization_id: organizationId } as any,
            auditContext,
            session
        );
    }
}
