export const CollectionName = {
    TodoList: 'todo-list',
    TodoItem: 'todo-item',
    Note: 'note',
} as const;

export type CollectionName = typeof CollectionName[keyof typeof CollectionName];