import { Controller, Get, Post, Put, Delete, Param, Body, Logger, NotFoundException, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
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
import { Auth, PrincipalContext, AuditContext as AuditContextDecorator } from '@trailmix-cms/cms';
import { type RequestPrincipal, Collections as CMSCollections, Services } from '@trailmix-cms/cms';
import * as models from '@trailmix-cms/models';

@Auth()
@ApiTags('todo-items')
@Controller('todo-items')
export class TodoItemController {
    private readonly logger = new Logger(TodoItemController.name);

    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoItemCollection: TodoItemCollection,
        private readonly authorizationService: Services.AuthorizationService,
    ) { }

    private async verifyTodoListAccess(todoListId: any, principal: RequestPrincipal): Promise<void> {
        const todoList = await this.todoListCollection.get(todoListId);
        if (!todoList) {
            throw new NotFoundException('Todo list not found');
        }

        // Verify user has access to the organization
        const organizationRole = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [models.RoleValue.User],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: todoList.organization_id,
        });

        if (!organizationRole) {
            throw new NotFoundException('Todo list not found or access denied');
        }
    }

    @Post()
    @ApiOperation({ summary: 'Create a new todo item in a list' })
    @ApiCreatedResponse({
        description: 'Todo item created successfully.',
        type: TodoItemResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async createItem(
        @Body() createDto: CreateTodoItemDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ): Promise<TodoItemResponseDto> {
        await this.verifyTodoListAccess(createDto.list_id, principal);
        this.logger.log(`Creating todo item in list: ${createDto.list_id}`);
        const result = await this.todoItemCollection.insertOne(
            createDto,
            auditContext
        );
        return result;
    }

    @Get()
    @ApiOperation({ summary: 'Get all todo items in a list' })
    @ApiOkResponse({
        description: 'List of all todo items in the list.',
        type: TodoItemListResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async getItemsByListId(
        @Query() query: TodoItemListQueryDto,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<TodoItemListResponseDto> {
        await this.verifyTodoListAccess(query.list_id, principal);
        const todoList = await this.todoListCollection.get(query.list_id);
        this.logger.log(`Getting all items for list: ${todoList!._id}`);
        const result = await this.todoItemCollection.find({ list_id: todoList!._id });
        return {
            items: result,
            count: result.length,
        };
    }

    @Get(':itemId')
    @ApiParam({ name: 'itemId', description: 'Todo item ID' })
    @ApiOperation({ summary: 'Get a todo item by ID' })
    @ApiOkResponse({
        description: 'Todo item found.',
        type: TodoItemResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo item not found.' })
    async getItemById(
        @Param('itemId', TodoItemByIdPipe) item: TodoItem.Entity,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<TodoItemResponseDto> {
        await this.verifyTodoListAccess(item.list_id, principal);
        return item;
    }

    @Put(':itemId')
    @ApiParam({ name: 'itemId', description: 'Todo item ID' })
    @ApiOperation({ summary: 'Update a todo item' })
    @ApiOkResponse({
        description: 'Todo item updated successfully.',
        type: TodoItemResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo item not found.' })
    async updateItem(
        @Param('itemId', TodoItemByIdPipe) item: TodoItem.Entity,
        @Body() updateDto: UpdateTodoItemDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ): Promise<TodoItemResponseDto> {
        await this.verifyTodoListAccess(item.list_id, principal);
        this.logger.log(`Updating todo item: ${item._id}`);
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
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContextDecorator() auditContext: AuditContext.Model,
    ): Promise<void> {
        await this.verifyTodoListAccess(item.list_id, principal);
        this.logger.log(`Deleting todo item: ${item._id}`);
        await this.todoItemCollection.deleteOne(item._id, auditContext);
    }
}

