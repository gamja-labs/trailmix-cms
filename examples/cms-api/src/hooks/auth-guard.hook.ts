import { Injectable } from '@nestjs/common';
import { AuthGuardHook } from '@trailmix-cms/cms';
import * as models from '../models';
import { TodoListCollection } from '../collections/todo-list.collection';

@Injectable()
export class AppAuthGuardHook implements AuthGuardHook {

    constructor(
        private readonly todoListCollection: TodoListCollection,
    ) {}

    async onHook(account: models.Account.Entity): Promise<boolean> {
        console.log('Auth Guard Hook', account);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Auth Guard Hook resolved');
        await this.todoListCollection.insertOne({
            name: 'My first todo list',
        }, {
            system: false,
            anonymous: false,
            account_id: account._id,
        });
        return true;
    }
}

