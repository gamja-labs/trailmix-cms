# Database Models

Database entities and models in Trailmix CMS provide type-safe data structures using Zod schemas and TypeScript.

## Creating Database Entities

To create your own database entities in Trailmix CMS, you need to complete two steps:

1. **Create a Entity**: Define the data structure using Zod schemas and TypeScript types
2. **Create a Collection**: Set up the MongoDB collection that uses your model for type-safe database operations

## Base Entity

All models extend from a base entity that includes common fields:

```typescript
import { BaseEntity } from '@trailmix-cms/models';

// BaseEntity includes:
// - _id: ObjectId
// - created_at: DateTime
// - updated_at?: DateTime (optional)
```

These fields are automatically created on creation/update.

## Creating a Entity

Define your entity using Zod schemas:

```typescript
import { z } from 'zod';
import { baseEntitySchema } from '@trailmix-cms/models';

// Define your model schema
export const todoSchema = baseEntitySchema.extend({
    title: z.string().min(1),
    description: z.string().optional(),
    completed: z.boolean().default(false),
    userId: z.string(),
});

// Infer the TypeScript type
export type Todo = z.infer<typeof todoSchema>;
```

## Creating Models for OpenAPI Schema

To create a reusable model that generate OpenAPI Schema, just add `id` in the models `meta`

```typescript
export const addressSchema = z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
}).meta({
    id: 'Address'
});

export const userSchema = baseEntitySchema.extend({
    email: z.string().email(),
    address: addressSchema.optional(),
}).meta({
    id: 'User'
});
```

## Model Codecs

Codecs in Trailmix CMS are Zod schemas that handle conversion between different data representations. They're essential for working with MongoDB types that need to be serialized differently when stored in the database versus when sent over APIs (as JSON). See [Zod Codecs](https://zod.dev/codecs).

### Available Codecs

Trailmix CMS provides two built-in codecs:

- **`ObjectId`**: Converts between string and MongoDB ObjectId
- **`DateTime`**: Converts between ISO string and JavaScript Date

#### Example Usage

```typescript
import { Base, Codecs } from '@trailmix-cms/models';

export const relationEntitySchema = Base.baseEntitySchema.extend({
    parent_id: Codecs.ObjectId,

});

export type Entity = z.infer<typeof relationEntitySchema>;
```


```typescript
import { Codecs } from '@trailmix-cms/models';

// DateTime codec handles MongoDB Date objects
export const eventSchema = baseEntitySchema.extend({
    startDate: Codecs.DateTime,
    endDate: Codecs.DateTime.optional(),
});
```

## Example: Complete Model

```typescript
import { z } from 'zod';
import { Base } from '@trailmix-cms/models';

export const entitySchema = Base.baseEntitySchema.extend({
    name: z.string(),
}).meta({
    id: 'TodoList',
});

export type Entity = z.infer<typeof entitySchema>;
```

```typescript
import { z } from 'zod';
import { Base, Codecs } from '@trailmix-cms/models';

export const entitySchema = Base.baseEntitySchema.extend({
    list_id: Codecs.ObjectId,
    text: z.string().min(1, 'Item text is required'),
    completed: z.boolean().optional(),
}).meta({
    id: 'TodoItem',
});

export type Entity = z.infer<typeof entitySchema>;
```

## Next Steps

Learn how to use these models with [Database Collections](./database-collections.md).



