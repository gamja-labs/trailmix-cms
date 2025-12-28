<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Todos | Trailmix',
})

import { ref, onMounted, computed, nextTick } from 'vue';
import { useApi } from '@/lib/api';
import type { TodoList, TodoItemResponseDto, CreateTodoListDto, CreateTodoItemDto, UpdateTodoItemDto, AccountDto } from '@/client/Api';

const { api } = useApi();

const todoLists = ref<TodoList[]>([]);
const todos = ref<TodoItemResponseDto[]>([]);
const selectedListId = ref<string | null>(null);
const loading = ref(false);
const listsLoading = ref(false);
const newTodoText = ref('');
const showCompleted = ref(false);
const editingTodoId = ref<string | null>(null);
const editingText = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);
const showCreateListDialog = ref(false);
const newListName = ref('');
const creatingList = ref(false);
const accountInfo = ref<AccountDto | null>(null);
const loadingAccountInfo = ref(false);

const selectedList = computed(() => {
    return todoLists.value.find(list => list._id === selectedListId.value) || null;
});

const activeTodos = computed(() => {
    return Array.isArray(todos.value) ? todos.value.filter(todo => !todo.completed) : [];
});

const completedTodos = computed(() => {
    return Array.isArray(todos.value) ? todos.value.filter(todo => todo.completed) : [];
});

const displayedTodos = computed(() => {
    if (showCompleted.value) {
        return [...activeTodos.value, ...completedTodos.value];
    }
    return activeTodos.value;
});

const loadTodoLists = async () => {
    try {
        listsLoading.value = true;
        const response = await api.todoLists.todoListControllerGetAllLists();
        todoLists.value = response.data.items || [];
        
        // If no list is selected and we have lists, select the first one
        if (!selectedListId.value && todoLists.value.length > 0) {
            selectedListId.value = todoLists.value[0]!._id;
        }
    } catch (error) {
        console.error('Failed to load todo lists:', error);
    } finally {
        listsLoading.value = false;
    }
};

const loadTodos = async (listId: string) => {
    if (!listId) {
        todos.value = [];
        return;
    }
    
    try {
        loading.value = true;
        const response = await api.todoItems.todoItemControllerGetItemsByListId({ list_id: listId });
        // Ensure we always have an array
        todos.value = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error('Failed to load todos:', error);
        todos.value = [];
    } finally {
        loading.value = false;
    }
};

const createTodoList = async () => {
    if (!newListName.value.trim()) {
        return;
    }

    try {
        creatingList.value = true;
        const createListData: CreateTodoListDto = {
            name: newListName.value.trim(),
        };
        const response = await api.todoLists.todoListControllerCreateList(createListData);
        todoLists.value.push(response.data);
        selectedListId.value = response.data._id;
        newListName.value = '';
        showCreateListDialog.value = false;
        await loadTodos(response.data._id);
    } catch (error: any) {
        console.error('Failed to create todo list:', error);
        alert(error?.error?.message || 'Failed to create todo list');
    } finally {
        creatingList.value = false;
    }
};

const selectList = async (listId: string) => {
    selectedListId.value = listId;
    await loadTodos(listId);
};

const createTodo = async () => {
    if (!newTodoText.value.trim() || !selectedListId.value) {
        return;
    }

    try {
        loading.value = true;
        const createData: CreateTodoItemDto = {
            list_id: selectedListId.value,
            text: newTodoText.value.trim(),
            completed: false,
        };
        const response = await api.todoItems.todoItemControllerCreateItem(createData);
        if (Array.isArray(todos.value) && response.data) {
            todos.value.push(response.data);
        }
        newTodoText.value = '';
    } catch (error: any) {
        console.error('Failed to create todo:', error);
        alert(error?.error?.message || 'Failed to create todo');
    } finally {
        loading.value = false;
    }
};

const toggleTodo = async (todoId: string) => {
    if (!Array.isArray(todos.value)) return;
    
    try {
        loading.value = true;
        const todo = todos.value.find(t => t._id === todoId);
        if (!todo) return;

        const updateData: UpdateTodoItemDto = {
            completed: !todo.completed,
        };
        const response = await api.todoItems.todoItemControllerUpdateItem(todoId, updateData);
        const updatedTodo = response.data;

        // Update in local state
        const index = todos.value.findIndex(t => t._id === todoId);
        if (index !== -1 && updatedTodo) {
            todos.value[index] = updatedTodo;
        }
    } catch (error) {
        console.error('Failed to toggle todo:', error);
    } finally {
        loading.value = false;
    }
};

const startEditing = async (todoId: string, currentText: string) => {
    editingTodoId.value = todoId;
    editingText.value = currentText;
    await nextTick();
    editInputRef.value?.focus();
};

const saveEdit = async () => {
    if (!editingTodoId.value || !editingText.value.trim() || !Array.isArray(todos.value)) {
        cancelEdit();
        return;
    }

    try {
        loading.value = true;
        const updateData: UpdateTodoItemDto = {
            text: editingText.value.trim(),
        };
        const response = await api.todoItems.todoItemControllerUpdateItem(editingTodoId.value, updateData);
        const updatedTodo = response.data;

        // Update in local state
        const index = todos.value.findIndex(t => t._id === editingTodoId.value);
        if (index !== -1 && updatedTodo) {
            todos.value[index] = updatedTodo;
        }
        cancelEdit();
    } catch (error) {
        console.error('Failed to update todo:', error);
    } finally {
        loading.value = false;
    }
};

const cancelEdit = () => {
    editingTodoId.value = null;
    editingText.value = '';
};

const deleteTodo = async (todoId: string) => {
    if (!confirm('Are you sure you want to delete this todo?') || !Array.isArray(todos.value)) {
        return;
    }

    try {
        loading.value = true;
        await api.todoItems.todoItemControllerDeleteItem(todoId);
        todos.value = todos.value.filter(t => t._id !== todoId);
    } catch (error) {
        console.error('Failed to delete todo:', error);
        alert('Failed to delete todo');
    } finally {
        loading.value = false;
    }
};

const getAccountInfo = async () => {
    try {
        loadingAccountInfo.value = true;
        const response = await api.account.accountControllerInfo();
        accountInfo.value = response.data;
        console.log('Account info:', response.data);
        alert(`Account Info:\nID: ${response.data._id}\nUser ID: ${response.data.user_id}\nName: ${response.data.name}`);
    } catch (error: any) {
        console.error('Failed to get account info:', error);
        alert(error?.error?.message || 'Failed to get account info');
    } finally {
        loadingAccountInfo.value = false;
    }
};

onMounted(async () => {
    await loadTodoLists();
    if (selectedListId.value) {
        await loadTodos(selectedListId.value);
    }
});
</script>

<template>
    <div class="todos-dashboard">
        <div class="todos-layout">
            <!-- Sidebar with Todo Lists -->
            <aside class="todos-sidebar">
                <div class="sidebar-header">
                    <h2 class="sidebar-title">Todo Lists</h2>
                    <button class="btn btn-primary btn-sm" @click="showCreateListDialog = true">
                        + New List
                    </button>
                </div>
                <div v-if="listsLoading" class="loading-small">Loading lists...</div>
                <div v-else-if="todoLists.length === 0" class="empty-state-small">
                    <p class="text-muted">No lists yet</p>
                </div>
                <nav v-else class="lists-nav">
                    <button
                        v-for="list in todoLists"
                        :key="list._id"
                        class="list-item"
                        :class="{ 'list-item-active': selectedListId === list._id }"
                        @click="selectList(list._id)"
                    >
                        {{ list.name }}
                    </button>
                </nav>
            </aside>

            <!-- Main Content -->
            <main class="todos-main">
                <div class="todos-header">
                    <h1 class="todos-title">{{ selectedList?.name || 'Select a list' }}</h1>
                    <div class="todos-controls">
                        <button 
                            class="btn btn-outline btn-sm" 
                            @click="getAccountInfo" 
                            :disabled="loadingAccountInfo"
                        >
                            {{ loadingAccountInfo ? 'Loading...' : 'Test Account Info' }}
                        </button>
                        <label class="toggle-label">
                            <input type="checkbox" v-model="showCompleted" />
                            <span>Show Completed</span>
                        </label>
                    </div>
                </div>

                <div v-if="!selectedListId" class="empty-state">
                    <p class="text-muted">Select a list from the sidebar or create a new one to get started.</p>
                </div>

                <template v-else>
                    <!-- Add Todo Form -->
                    <div class="add-todo-form card">
                        <div class="form-group">
                            <input
                                v-model="newTodoText"
                                type="text"
                                placeholder="What needs to be done?"
                                class="todo-input"
                                @keyup.enter="createTodo"
                            />
                        </div>
                        <button class="btn btn-primary" @click="createTodo" :disabled="loading || !newTodoText.trim()">
                            Add Todo
                        </button>
                    </div>

                    <!-- Todos List -->
                    <div v-if="loading && displayedTodos.length === 0" class="loading">
                        Loading todos...
                    </div>
                    <div v-else-if="displayedTodos.length === 0" class="empty-state">
                        <p class="text-muted">No todos yet. Add one above to get started!</p>
                    </div>
                    <div v-else class="todos-list">
                        <div
                            v-for="todo in displayedTodos"
                            :key="todo._id"
                            class="todo-item card"
                            :class="{ 'todo-completed': todo.completed }"
                        >
                            <div class="todo-content">
                                <div class="todo-checkbox-container">
                                    <input
                                        type="checkbox"
                                        :checked="todo.completed"
                                        @change="toggleTodo(todo._id)"
                                        class="todo-checkbox"
                                    />
                                </div>
                                <div class="todo-text-container">
                                    <div v-if="editingTodoId === todo._id" class="todo-edit-form">
                                        <input
                                            v-model="editingText"
                                            type="text"
                                            class="todo-edit-input"
                                            @keyup.enter="saveEdit"
                                            @keyup.escape="cancelEdit"
                                            @blur="saveEdit"
                                            ref="editInputRef"
                                        />
                                    </div>
                                    <div v-else class="todo-display">
                                        <div class="todo-label" @dblclick="startEditing(todo._id, todo.text)">
                                            {{ todo.text }}
                                        </div>
                                    </div>
                                </div>
                                <div class="todo-actions">
                                    <button
                                        v-if="editingTodoId !== todo._id"
                                        class="btn btn-ghost btn-sm"
                                        @click="startEditing(todo._id, todo.text)"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        class="btn btn-destructive btn-sm"
                                        @click="deleteTodo(todo._id)"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div v-if="displayedTodos.length > 0" class="todos-summary">
                        <p class="text-muted">
                            {{ activeTodos.length }} active, {{ completedTodos.length }} completed
                        </p>
                    </div>
                </template>
            </main>
        </div>

        <!-- Create List Dialog -->
        <div v-if="showCreateListDialog" class="dialog-overlay" @click.self="showCreateListDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">Create New List</h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="list-name">List Name</label>
                        <input
                            id="list-name"
                            v-model="newListName"
                            type="text"
                            placeholder="Enter list name"
                            class="todo-input"
                            @keyup.enter="createTodoList"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showCreateListDialog = false">Cancel</button>
                    <button class="btn btn-primary" @click="createTodoList" :disabled="creatingList || !newListName.trim()">
                        {{ creatingList ? 'Creating...' : 'Create' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.todos-dashboard {
    width: 100%;
}

.todos-layout {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
}

.todos-sidebar {
    width: 250px;
    flex-shrink: 0;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    padding: 1.5rem;
    position: sticky;
    top: 2rem;
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 0.5rem;
}

.sidebar-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
}

.loading-small,
.empty-state-small {
    text-align: center;
    padding: 1rem;
    font-size: 0.875rem;
}

.lists-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.list-item {
    padding: 0.75rem 1rem;
    text-align: left;
    border: none;
    background: transparent;
    color: hsl(var(--foreground));
    border-radius: calc(var(--radius) - 2px);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;

    &:hover {
        background-color: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
    }

    &.list-item-active {
        background-color: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-weight: 500;
    }
}

.todos-main {
    flex: 1;
    min-width: 0;
}

.todos-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
    flex-wrap: wrap;
}

.todos-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.todos-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));

    input[type="checkbox"] {
        cursor: pointer;
    }

    &:hover {
        color: hsl(var(--foreground));
    }
}

.add-todo-form {
    margin-bottom: 2rem;
    padding: 1.5rem;
}

.form-group {
    margin-bottom: 1rem;

    &:last-child {
        margin-bottom: 0;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: hsl(var(--foreground));
    }
}

.todo-input {
    width: 100%;
    padding: 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid hsl(var(--input));
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 1rem;
    transition: all 0.2s;

    &:focus {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
        border-color: hsl(var(--ring));
    }

    &::placeholder {
        color: hsl(var(--muted-foreground));
    }
}

.loading,
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
}

.todos-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
}

.todo-item {
    padding: 1rem 1.5rem;
    transition: all 0.2s;

    &.todo-completed {
        opacity: 0.6;

        .todo-label {
            text-decoration: line-through;
            color: hsl(var(--muted-foreground));
        }
    }

    &:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
    }
}

.todo-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
}

.todo-checkbox-container {
    flex-shrink: 0;
    padding-top: 0.25rem;
}

.todo-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: hsl(var(--primary));
}

.todo-text-container {
    flex: 1;
    min-width: 0;
}

.todo-display {
    width: 100%;
}

.todo-label {
    font-size: 1rem;
    font-weight: 500;
    color: hsl(var(--foreground));
    cursor: text;
    word-wrap: break-word;
    margin-bottom: 0.25rem;
}

.todo-edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.todo-edit-input {
    width: 100%;
    padding: 0.5rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid hsl(var(--input));
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 1rem;
    transition: all 0.2s;

    &:focus {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
        border-color: hsl(var(--ring));
    }
}

.todo-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
}

.todos-summary {
    text-align: center;
    padding: 1rem;
    border-top: 1px solid hsl(var(--border));
    margin-top: 2rem;
}
</style>
