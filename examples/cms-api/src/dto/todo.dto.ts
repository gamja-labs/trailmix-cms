import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { entitySchema as TodoListEntitySchema } from '../models/todo-list';
import { entitySchema as TodoItemEntitySchema } from '../models/todo-item';
import { Codecs, InternalFields } from '@trailmix-cms/models';

// Todo List Schemas
export const CreateTodoListSchema = TodoListEntitySchema.omit(InternalFields);
export type CreateTodoListSchema = z.input<typeof CreateTodoListSchema>;
export class CreateTodoListDto extends createZodDto(CreateTodoListSchema, { codec: true }) { }

export const UpdateTodoListSchema = TodoListEntitySchema.omit(InternalFields).partial();
export type UpdateTodoListSchema = z.input<typeof UpdateTodoListSchema>;
export class UpdateTodoListDto extends createZodDto(UpdateTodoListSchema, { codec: true }) { }

export const TodoListResponseSchema = TodoListEntitySchema;
export type TodoListResponseSchema = z.input<typeof TodoListResponseSchema>;
export class TodoListResponseDto extends createZodDto(TodoListResponseSchema, { codec: true }) { }

export const TodoListListResponseSchema = z.object({
    items: z.array(TodoListEntitySchema),
    count: z.number(),
});
export type TodoListListResponseSchema = z.input<typeof TodoListListResponseSchema>;
export class TodoListListResponseDto extends createZodDto(TodoListListResponseSchema, { codec: true }) { }

// Todo Item Schemas
export const CreateTodoItemSchema = TodoItemEntitySchema.omit(InternalFields);
export type CreateTodoItemSchema = z.input<typeof CreateTodoItemSchema>;
export class CreateTodoItemDto extends createZodDto(CreateTodoItemSchema, { codec: true }) { }

export const UpdateTodoItemSchema = TodoItemEntitySchema.omit(InternalFields).partial();
export type UpdateTodoItemSchema = z.input<typeof UpdateTodoItemSchema>;
export class UpdateTodoItemDto extends createZodDto(UpdateTodoItemSchema, { codec: true }) { }

export const TodoItemResponseSchema = TodoItemEntitySchema;
export type TodoItemResponseSchema = z.input<typeof TodoItemResponseSchema>;
export class TodoItemResponseDto extends createZodDto(TodoItemResponseSchema, { codec: true }) { }

export const TodoItemListResponseSchema = z.object({
    items: z.array(TodoItemEntitySchema),
    count: z.number(),
});
export type TodoItemListResponseSchema = z.input<typeof TodoItemListResponseSchema>;
export class TodoItemListResponseDto extends createZodDto(TodoItemListResponseSchema, { codec: true }) { }

export const TodoItemListQuerySchema = z.object({
    list_id: Codecs.ObjectId,
});
export type TodoItemListQuerySchema = z.input<typeof TodoItemListQuerySchema>;
export class TodoItemListQueryDto extends createZodDto(TodoItemListQuerySchema, { codec: true }) { }


