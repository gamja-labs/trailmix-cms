import { Injectable } from '@nestjs/common';
import { ObjectId } from 'bson';
import { TodoListCollection } from '../collections/todo-list.collection';
import { TodoItemCollection } from '../collections/todo-item.collection';
import { AuditContext } from '@trailmix-cms/models';
import { DatabaseService } from '@trailmix-cms/db';

@Injectable()
export class TodoListService {
    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoItemCollection: TodoItemCollection,
        private readonly databaseService: DatabaseService
    ) { }

    async deleteList(id: ObjectId, auditContext: AuditContext.Model): Promise<void> {
        const session = this.databaseService.startSession();
        await session.withTransaction(async () => {
            await this.todoListCollection.deleteOne(id, auditContext, session);
            await this.todoItemCollection.deleteMany({ list_id: id }, auditContext, session);
        });
        await session.endSession();
    }
}

