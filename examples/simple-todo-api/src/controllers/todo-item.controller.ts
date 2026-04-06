import { Controller, Get, Post, Put, Delete, Param, Body, Logger, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { TodoListService } from '../services/todo-list.service';
import {
    CreateTodoItemDto,
    UpdateTodoItemDto,
    TodoItemResponseDto,
    TodoItemListQueryDto,
    TodoItemListResponseDto,
} from '../dto/todo.dto';
import { TodoItemByIdPipe } from '../pipes';
import { TodoItem } from '../models';
import { TodoItemCollection, TodoListCollection } from '../collections';
import { AuditContext } from '@trailmix-cms/models';

@ApiTags('todo-items')
@Controller('todo-items')
export class TodoItemController {
    private readonly logger = new Logger(TodoItemController.name);

    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoItemCollection: TodoItemCollection
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new todo item in a list' })
    @ZodResponse({ status: 201, description: 'Todo item created successfully.', type: TodoItemResponseDto })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async createItem(
        @Body() createDto: CreateTodoItemDto,
    ) {
        const todoList = await this.todoListCollection.get(createDto.list_id);
        if (!todoList) {
            throw new NotFoundException('Todo list not found');
        }
        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }
        this.logger.log(`Creating todo item in list: ${createDto.list_id}`);
        const result = await this.todoItemCollection.insertOne(
            createDto,
            auditContext
        );
        return result;
    }

    @Get()
    @ApiOperation({ summary: 'Get all todo items in a list' })
    @ZodResponse({ status: 200, description: 'List of all todo items in the list.', type: TodoItemListResponseDto })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async getItemsByListId(@Query() query: TodoItemListQueryDto) {
        const todoList = await this.todoListCollection.get(query.list_id);
        if (!todoList) {
            throw new NotFoundException('Todo list not found');
        }
        this.logger.log(`Getting all items for list: ${todoList._id}`);
        const result = await this.todoItemCollection.find({ list_id: todoList._id });
        return {
            items: result,
            count: result.length,
        };
    }

    @Get(':itemId')
    @ApiParam({ name: 'itemId', description: 'Todo item ID' })
    @ApiOperation({ summary: 'Get a todo item by ID' })
    @ZodResponse({ status: 200, description: 'Todo item found.', type: TodoItemResponseDto })
    @ApiNotFoundResponse({ description: 'Todo item not found.' })
    getItemById(
        @Param('itemId', TodoItemByIdPipe) item: TodoItem.Entity,
    ) {
        return item;
    }

    @Put(':itemId')
    @ApiParam({ name: 'itemId', description: 'Todo item ID' })
    @ApiOperation({ summary: 'Update a todo item' })
    @ZodResponse({ status: 200, description: 'Todo item updated successfully.', type: TodoItemResponseDto })
    @ApiNotFoundResponse({ description: 'Todo item not found.' })
    updateItem(
        @Param('itemId', TodoItemByIdPipe) item: TodoItem.Entity,
        @Body() updateDto: UpdateTodoItemDto,
    ) {
        this.logger.log(`Updating todo item: ${item._id}`);
        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }
        return this.todoItemCollection.findOneAndUpdate({ _id: item._id }, {
            $set: updateDto
        }, auditContext);
    }

    @Delete(':itemId')
    @ApiParam({ name: 'itemId', description: 'Todo item ID' })
    @ApiOperation({ summary: 'Delete a todo item' })
    @ApiOkResponse({ description: 'Todo item deleted successfully.' })
    @ApiNotFoundResponse({ description: 'Todo item not found.' })
    async deleteItem(
        @Param('itemId', TodoItemByIdPipe) item: TodoItem.Entity,
    ): Promise<void> {
        this.logger.log(`Deleting todo item: ${item._id}`);
        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }
        await this.todoItemCollection.deleteOne(item._id, auditContext);
    }
}

