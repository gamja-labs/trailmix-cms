import { Controller, Get, Post, Put, Delete, Param, Body, Logger, Query, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import * as dto from '../dto/todo.dto';
import { TodoListByIdPipe } from '../pipes';
import { TodoList } from '../models';
import { TodoListCollection } from '../collections';
import * as models from '@trailmix-cms/models';
import { TodoListService } from '../services/todo-list.service';
import { type RequestPrincipal, Auth, PrincipalContext, AuditContext, Services } from '@trailmix-cms/cms';
import { ObjectId } from 'mongodb';

@Auth()
@ApiTags('todo-lists')
@Controller('todo-lists')
export class TodoListController {
    private readonly logger = new Logger(TodoListController.name);

    constructor(
        private readonly todoListCollection: TodoListCollection,
        private readonly todoListService: TodoListService,
        private readonly authorizationService: Services.AuthorizationService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new todo list' })
    @ApiCreatedResponse({
        description: 'Todo list created successfully.',
        type: dto.TodoListResponseDto,
    })
    async createList(
        @Body() createDto: dto.CreateTodoListDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: models.AuditContext.Model,
    ): Promise<dto.TodoListResponseDto> {
        this.logger.log(`Creating todo list: ${createDto.name}`);

        if (!createDto.organization_id) {
            throw new BadRequestException('organization_id is required');
        }

        // Verify user has access to the organization
        const organizationRole = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [models.RoleValue.User],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: createDto.organization_id,
        });

        if (!organizationRole) {
            throw new ForbiddenException('You do not have permission to create todo lists in this organization');
        }

        const result = await this.todoListCollection.insertOne({
            name: createDto.name,
            organization_id: createDto.organization_id,
        }, auditContext);
        return result;
    }

    @Get()
    @ApiOperation({ summary: 'Get all todo lists' })
    @ApiQuery({ name: 'organization_id', required: false, description: 'Filter by organization ID (required unless user is global admin)' })
    @ApiOkResponse({
        description: 'List of all todo lists.',
        type: dto.TodoListListResponseDto,
    })
    async getAllLists(
        @Query('organization_id') organizationId?: string,
        @PrincipalContext() principal?: RequestPrincipal,
    ): Promise<dto.TodoListListResponseDto> {
        this.logger.log('Getting all todo lists');

        if (!principal) {
            throw new BadRequestException('organization_id is required');
        }

        // Check if user is a global admin
        const isGlobalAdmin = await this.authorizationService.isGlobalAdmin(
            principal.entity._id,
            principal.principal_type
        );

        let filter: any = {};

        if (organizationId) {
            const orgId = new ObjectId(organizationId);
            // Verify user has access to the organization
            const hasAccess = await this.authorizationService.resolveOrganizationAuthorization({
                principal,
                rolesAllowList: [models.RoleValue.User, models.RoleValue.Admin, models.RoleValue.Owner, models.RoleValue.Reader],
                principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
                organizationId: orgId,
            });

            if (!hasAccess) {
                throw new NotFoundException('Organization not found or access denied');
            }
            filter.organization_id = orgId;
        } else {
            // If no organization_id specified, require it unless user is global admin
            if (!isGlobalAdmin) {
                throw new BadRequestException('organization_id is required');
            }
            // Global admin can list all - no filter needed
        }

        const todoLists = await this.todoListCollection.find(filter);
        const result = {
            items: todoLists,
            count: todoLists.length,
        };
        return result;
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a todo list by ID' })
    @ApiParam({ name: 'id', description: 'Todo list ID' })
    @ApiOkResponse({
        description: 'Todo list found.',
        type: dto.TodoListResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async getListById(
        @Param('id', TodoListByIdPipe) todoList: TodoList.Entity,
        @PrincipalContext() principal: RequestPrincipal,
    ): Promise<dto.TodoListResponseDto> {
        // Verify user has access to the organization
        const hasAccess = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [models.RoleValue.User],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: todoList.organization_id,
        });

        if (!hasAccess) {
            throw new NotFoundException('Todo list not found or access denied');
        }

        return todoList;
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a todo list' })
    @ApiParam({ name: 'id', description: 'Todo list ID' })
    @ApiOkResponse({
        description: 'Todo list updated successfully.',
        type: dto.TodoListResponseDto,
    })
    @ApiNotFoundResponse({ description: 'Todo list not found.' })
    async updateList(
        @Param('id', TodoListByIdPipe) todoList: TodoList.Entity,
        @Body() updateDto: dto.UpdateTodoListDto,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: models.AuditContext.Model,
    ): Promise<dto.TodoListResponseDto> {
        // Verify user has access to the organization
        const hasAccess = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [models.RoleValue.User],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: todoList.organization_id,
        });

        if (!hasAccess) {
            throw new NotFoundException('Todo list not found or access denied');
        }

        this.logger.log(`Updating todo list: ${todoList._id}`);

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
    async deleteList(
        @Param('id', TodoListByIdPipe) todoList: TodoList.Entity,
        @PrincipalContext() principal: RequestPrincipal,
        @AuditContext() auditContext: models.AuditContext.Model,
    ) {
        // Verify user has access to the organization
        const hasAccess = await this.authorizationService.resolveOrganizationAuthorization({
            principal,
            rolesAllowList: [models.RoleValue.User],
            principalTypeAllowList: [models.Principal.Account, models.Principal.ApiKey],
            organizationId: todoList.organization_id,
        });

        if (!hasAccess) {
            throw new NotFoundException('Todo list not found or access denied');
        }

        this.logger.log(`Deleting todo list: ${todoList._id}`);
        await this.todoListService.deleteList(todoList._id, auditContext);
    }
}

