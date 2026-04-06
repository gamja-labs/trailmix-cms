import { Injectable } from '@nestjs/common';
import { TodoItem } from '../models';
import { BaseEntityByIdPipe } from '@trailmix-cms/utils';
import { TodoItemCollection } from '../collections';

@Injectable()
export class TodoItemByIdPipe extends BaseEntityByIdPipe<TodoItem.Entity> {
    constructor(
        protected readonly collection: TodoItemCollection
    ) {
        super(collection);
    }


}