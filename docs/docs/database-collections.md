# Database Collections

Database collections in Trailmix CMS provide a type-safe way to interact with MongoDB collections using your models.

## Creating a Collection

Create a collection by extending `AuditedCollection` and implementing the required properties:

```typescript
import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection } from '@trailmix-cms/db';
import { TodoItem } from '../models';
import { CollectionName } from '../constants';

type Entity = TodoItem.Entity
const collectionName = CollectionName.TodoItem;

@Injectable()
export class TodoItemCollection extends AuditedCollection<Entity> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = TodoItem.entitySchema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Entity>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection
    ) {
        super(collection, databaseService, auditCollection);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        await this.collection.createIndex({ list_id: 1 });
    }
}
```

## Using Collections

Inject collections into your services using the `@DocumentCollection` decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { DocumentCollection } from '@trailmix-cms/db';
import { TodoItemCollection } from './collections/todo-item.collection';
import { TodoItem } from './models/todo-item';

@Injectable()
export class TodoItemService {
    constructor(
        @DocumentCollection(CollectionName.TodoItem)
        private readonly todoItemCollection: TodoItemCollection,
    ) {}

    async findAll(): Promise<TodoItem.Entity[]> {
        return this.todoItemCollection.find({});
    }

    async findById(id: string): Promise<TodoItem.Entity | null> {
        return this.todoItemCollection.findById(id);
    }

    async create(todo: Omit<TodoItem.Entity, '_id' | 'created_at' | 'updated_at'>): Promise<TodoItem.Entity> {
        return this.todoItemCollection.create(todo);
    }
}
```


## Audited Collections

All collections extend `AuditedCollection` which provides automatic audit trail functionality:

```typescript
import { Collection } from 'mongodb';
import { Injectable } from '@nestjs/common';
import { DocumentCollection, DatabaseService, Collections, AuditedCollection } from '@trailmix-cms/db';
import { TodoList } from '../models';
import { CollectionName } from '../constants';

type Record = TodoList.Entity
const collectionName = CollectionName.TodoList;

@Injectable()
export class TodoListCollection extends AuditedCollection<Record> {
    public readonly collectionName = collectionName;
    public readonly entitySchema = TodoList.entitySchema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Record>,
        protected readonly databaseService: DatabaseService,
        protected readonly auditCollection: Collections.AuditCollection
    ) {
        super(collection, databaseService, auditCollection);
    }
}
```

Audited collections automatically include:
- `action`: Action taken on the record `['create', 'update', 'delete']`
- `context`: What identity preformed the action on the entity.
- By default, only users with Admin role can query the Audit endpoints.

## Non-Audited Collections

For collections that don't need audit trails, extend `BaseCollection` instead of `AuditedCollection`. This is useful for system collections or collections that don't require change tracking:

```typescript
import { Collection } from 'mongodb';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DocumentCollection, DatabaseService, BaseCollection } from '@trailmix-cms/db';
import { TodoItem } from '../models';
import { CollectionName } from '../constants';

type Entity = TodoItem.Entity
const collectionName = CollectionName.TodoItem;

@Injectable()
export class TodoItemCollection extends BaseCollection<Entity> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    public readonly collectionName = collectionName;
    public readonly entitySchema = TodoItem.entitySchema;

    constructor(
        @DocumentCollection(collectionName)
        protected readonly collection: Collection<Entity>,
        protected readonly databaseService: DatabaseService
    ) {
        super(collection, databaseService);
    }

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        await this.collection.createIndex({ list_id: 1 });
        await this.collection.createIndex({ completed: 1, created_at: -1 });
    }
}
```

Key differences from audited collections:
- **Extends `BaseCollection`**: Provides all standard CRUD operations without audit functionality
- **No audit context required**: Methods like `insertOne`, `findOneAndUpdate`, `deleteOne`, etc. don't require an `auditContext` parameter
- **No automatic audit trail**: Changes are not automatically tracked in the audit collection

## Type Safety

Collections are fully typed based on your model:

```typescript
// TypeScript knows the return type
const todo: Todo | null = await todoCollection.findById(id);

// TypeScript validates the filter
const todos = await todoCollection.find({ 
    completed: false, // ✅ Valid
    invalidField: 'value' // ❌ TypeScript error
});
```

## Custom Indexes

Use `OnModuleInit` to create custom indexes when the module initializes:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TodoItemCollection extends AuditedCollection<Record> implements OnModuleInit {
    private readonly logger = new Logger(this.constructor.name);
    
    // ... other properties ...

    async onModuleInit() {
        this.logger.verbose(`creating custom indexes for collection_${collectionName}`)
        await this.collection.createIndex({ list_id: 1 });
        // Add more indexes as needed
    }
}
```

## Next Steps

- Review the [Configuration](./configuration.md) guide
- Check out the [example applications](../../examples/) for complete implementations




