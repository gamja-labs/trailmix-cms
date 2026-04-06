import { Controller, Get, Post, Put, Delete, Param, Body, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import * as dto from '../dto/todo.dto';
import { TodoListByIdPipe } from '../pipes';
import { TodoList } from '../models';
import { TodoListCollection } from '../collections';
import { AuditContext } from '@trailmix-cms/models';
import { TodoListService } from 'src/services/todo-list.service';

@ApiTags('todo-lists')
@Controller('todo-lists')
export class TodoListController {
    private readonly logger = new Logger(TodoListController.name);

    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoListService: TodoListService
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new todo list' })
    @ZodResponse({ status: 201, description: 'Todo list created successfully.', type: dto.TodoListResponseDto })
    async createList(@Body() createDto: dto.CreateTodoListDto) {
        this.logger.log(`Creating todo list: ${createDto.name}`);

        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }

        const result = await this.todoListCollection.insertOne({
            name: createDto.name,
        }, auditContext);
        return result;
    }

    @Get()
    @ApiOperation({ summary: 'Get all todo lists' })
    @ZodResponse({ status: 200, description: 'List of all todo lists.', type: dto.TodoListListResponseDto })
    async getAllLists() {
        this.logger.log('Getting all todo lists');
        const todoLists = await this.todoListCollection.find({});
        const result = {
            items: todoLists,
            count: todoLists.length,
        };
        return result;
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a todo list by ID' })
    @ApiParam({ name: 'id', description: 'Todo list ID' })
    @ZodResponse({ status: 200, description: 'Todo list found.', type: dto.TodoListResponseDto })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async getListById(@Param('id', TodoListByIdPipe) todoList: TodoList.Entity) {
        return todoList;
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a todo list' })
    @ApiParam({ name: 'id', description: 'Todo list ID' })
    @ZodResponse({ status: 200, description: 'Todo list updated successfully.', type: dto.TodoListResponseDto })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async updateList(
        @Param('id', TodoListByIdPipe) todoList: TodoList.Entity,
        @Body() updateDto: dto.UpdateTodoListDto,
    ) {
        this.logger.log(`Updating todo list: ${todoList._id}`);

        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }

        const result = await this.todoListCollection.findOneAndUpdate({ _id: todoList._id }, {
            $set: updateDto
        }, auditContext);

        return result;
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a todo list' })
    @ApiParam({ name: 'id', description: 'Todo list ID' })
    @ApiOkResponse({ description: 'Todo list deleted successfully.' })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async deleteList(@Param('id', TodoListByIdPipe) todoList: TodoList.Entity) {
        this.logger.log(`Deleting todo list: ${todoList._id}`);
        const auditContext: AuditContext.Model = {
            system: false,
            anonymous: true,
        }
        await this.todoListService.deleteList(todoList._id, auditContext);
    }
}

