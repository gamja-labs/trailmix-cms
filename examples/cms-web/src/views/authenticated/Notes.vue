<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Notes | Trailmix',
})

import { ref, onMounted } from 'vue';
import { useApi } from '@/lib/api';
import type {
    NoteResponseDto,
    CreateNoteDto,
    UpdateNoteDto,
    VersionedAudit,
} from '@/client/Api';

const { api } = useApi();

const notes = ref<NoteResponseDto[]>([]);
const notesLoading = ref(false);

// Create
const showCreateDialog = ref(false);
const creating = ref(false);
const newNote = ref<CreateNoteDto>({ title: '', body: '' });

// Edit — `version` carries the value we last read so the API can detect
// a stale write (optimistic concurrency).
const showEditDialog = ref(false);
const updating = ref(false);
const editId = ref<string | null>(null);
const editData = ref<UpdateNoteDto>({ title: '', body: '', version: 0 });

const loadNotes = async () => {
    try {
        notesLoading.value = true;
        const response = await api.notes.noteControllerGetNotes();
        notes.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load notes:', error);
        alert(error?.error?.message || 'Failed to load notes');
    } finally {
        notesLoading.value = false;
    }
};

const openCreateDialog = () => {
    newNote.value = { title: '', body: '' };
    showCreateDialog.value = true;
};

const createNote = async () => {
    if (!newNote.value.title.trim()) {
        return;
    }
    try {
        creating.value = true;
        // No version on create — the server seeds it at 0.
        await api.notes.noteControllerCreateNote(newNote.value);
        await loadNotes();
        showCreateDialog.value = false;
    } catch (error: any) {
        console.error('Failed to create note:', error);
        alert(error?.error?.message || 'Failed to create note');
    } finally {
        creating.value = false;
    }
};

const openEditDialog = (note: NoteResponseDto) => {
    editId.value = note._id;
    editData.value = {
        title: note.title,
        body: note.body ?? '',
        version: note.version,
    };
    showEditDialog.value = true;
};

const updateNote = async () => {
    if (!editId.value || !editData.value.title?.trim()) {
        return;
    }
    try {
        updating.value = true;
        // Sends the expected version; a mismatch comes back as HTTP 409.
        await api.notes.noteControllerUpdateNote(editId.value, editData.value);
        await loadNotes();
        showEditDialog.value = false;
    } catch (error: any) {
        if (error?.status === 409) {
            alert('This note was changed by someone else. Reloading the latest version.');
            await loadNotes();
            showEditDialog.value = false;
            return;
        }
        console.error('Failed to update note:', error);
        alert(error?.error?.message || 'Failed to update note');
    } finally {
        updating.value = false;
    }
};

const deleteNote = async (note: NoteResponseDto) => {
    if (!confirm(`Delete "${note.title}" (version ${note.version})?`)) {
        return;
    }
    try {
        notesLoading.value = true;
        // Delete is version-checked too.
        await api.notes.noteControllerDeleteNote(note._id, { version: note.version });
        await loadNotes();
    } catch (error: any) {
        if (error?.status === 409) {
            alert('This note was changed by someone else. Reloading the latest version.');
            await loadNotes();
            return;
        }
        console.error('Failed to delete note:', error);
        alert(error?.error?.message || 'Failed to delete note');
    } finally {
        notesLoading.value = false;
    }
};

// Debug: versioned audit history for a single note.
const showAuditDialog = ref(false);
const auditNote = ref<NoteResponseDto | null>(null);
const versionedAudits = ref<VersionedAudit[]>([]);
const auditsLoading = ref(false);

const openAuditDialog = async (note: NoteResponseDto) => {
    auditNote.value = note;
    versionedAudits.value = [];
    showAuditDialog.value = true;
    try {
        auditsLoading.value = true;
        const response = await api.notes.noteControllerGetNoteVersionedAudits(note._id);
        versionedAudits.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load versioned audits:', error);
        alert(error?.error?.message || 'Failed to load versioned audits');
    } finally {
        auditsLoading.value = false;
    }
};

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

const formatDate = (dateString?: string) => {
    return dateString ? new Date(dateString).toLocaleString() : '—';
};

onMounted(async () => {
    await loadNotes();
});
</script>

<template>
    <div class="notes-dashboard">
        <div class="section-header">
            <h1 class="notes-title">Notes</h1>
            <div class="section-actions">
                <button class="btn btn-outline btn-sm" @click="loadNotes" :disabled="notesLoading">
                    {{ notesLoading ? 'Loading...' : 'Refresh' }}
                </button>
                <button class="btn btn-primary btn-sm" @click="openCreateDialog">
                    + New Note
                </button>
            </div>
        </div>

        <p class="text-muted notes-intro">
            Notes are versioned. Each save increments the version, and edits/deletes must
            send the version they last saw — a stale write is rejected with HTTP 409.
        </p>

        <div v-if="notesLoading" class="loading">Loading notes...</div>
        <div v-else-if="notes.length === 0" class="empty-state">
            <p class="text-muted">No notes yet. Create one to get started.</p>
        </div>
        <div v-else class="notes-list">
            <div v-for="note in notes" :key="note._id" class="note-item card">
                <div class="note-content">
                    <div class="note-info">
                        <div class="note-header">
                            <span class="note-name">{{ note.title }}</span>
                            <span class="version-badge">v{{ note.version }}</span>
                        </div>
                        <p v-if="note.body" class="note-body">{{ note.body }}</p>
                        <div class="note-details">
                            <div class="note-detail-row">
                                <span class="note-label">ID:</span>
                                <span class="note-value">{{ note._id }}</span>
                            </div>
                            <div class="note-detail-row">
                                <span class="note-label">Updated:</span>
                                <span class="note-value">{{ formatDate(note.updated_at) }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="note-actions">
                        <button class="btn btn-ghost btn-sm" @click="openAuditDialog(note)">History</button>
                        <button class="btn btn-outline btn-sm" @click="openEditDialog(note)">Edit</button>
                        <button class="btn btn-destructive btn-sm" @click="deleteNote(note)" :disabled="notesLoading">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Note Dialog -->
        <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">New Note</h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="new-note-title">Title *</label>
                        <input id="new-note-title" v-model="newNote.title" type="text" placeholder="Enter a title"
                            class="todo-input" @keyup.enter="createNote" />
                    </div>
                    <div class="form-group">
                        <label for="new-note-body">Body</label>
                        <textarea id="new-note-body" v-model="newNote.body" placeholder="Write something..."
                            class="todo-input" rows="4"></textarea>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showCreateDialog = false">Cancel</button>
                    <button class="btn btn-primary" @click="createNote" :disabled="creating || !newNote.title.trim()">
                        {{ creating ? 'Creating...' : 'Create' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Edit Note Dialog -->
        <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">Edit Note <span class="version-badge">v{{ editData.version }}</span></h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="edit-note-title">Title *</label>
                        <input id="edit-note-title" v-model="editData.title" type="text" placeholder="Enter a title"
                            class="todo-input" @keyup.enter="updateNote" />
                    </div>
                    <div class="form-group">
                        <label for="edit-note-body">Body</label>
                        <textarea id="edit-note-body" v-model="editData.body" placeholder="Write something..."
                            class="todo-input" rows="4"></textarea>
                    </div>
                    <p class="text-muted edit-hint">Saving as version {{ editData.version }} → {{ editData.version + 1 }}.</p>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showEditDialog = false">Cancel</button>
                    <button class="btn btn-primary" @click="updateNote" :disabled="updating || !editData.title?.trim()">
                        {{ updating ? 'Saving...' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Versioned Audit Debug Dialog -->
        <div v-if="showAuditDialog" class="dialog-overlay" @click.self="showAuditDialog = false">
            <div class="dialog-content dialog-content-wide">
                <div class="dialog-header">
                    <h2 class="dialog-title">
                        Versioned Audit History
                        <span v-if="auditNote" class="audit-note-title">— {{ auditNote.title }}</span>
                    </h2>
                </div>
                <div class="dialog-body">
                    <div v-if="auditsLoading" class="loading">Loading audit history...</div>
                    <div v-else-if="versionedAudits.length === 0" class="empty-state">
                        <p class="text-muted">No audit records found for this note.</p>
                    </div>
                    <div v-else class="audit-list">
                        <div v-for="audit in versionedAudits" :key="audit._id" class="audit-entry card">
                            <div class="audit-entry-header">
                                <span class="action-badge" :class="`action-${audit.action}`">{{ audit.action }}</span>
                                <span class="audit-entry-date">{{ formatDate(audit.created_at) }}</span>
                            </div>
                            <pre class="audit-json">{{ prettyJson(audit) }}</pre>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button
                        class="btn btn-outline"
                        @click="auditNote && openAuditDialog(auditNote)"
                        :disabled="auditsLoading"
                    >
                        {{ auditsLoading ? 'Loading...' : 'Refresh' }}
                    </button>
                    <button class="btn btn-primary" @click="showAuditDialog = false">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.notes-dashboard {
    width: 100%;
}

.notes-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.notes-intro {
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
}

.section-actions {
    display: flex;
    gap: 0.5rem;
}

.loading,
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
}

.notes-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.note-item {
    padding: 1.5rem;
    transition: all 0.2s;

    &:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
    }
}

.note-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
}

.note-info {
    flex: 1;
    min-width: 0;
}

.note-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.note-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.version-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: monospace;
    border-radius: 9999px;
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
}

.note-body {
    margin: 0 0 0.75rem;
    color: hsl(var(--foreground));
    white-space: pre-wrap;
}

.note-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.note-detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.note-label {
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    min-width: 80px;
}

.note-value {
    color: hsl(var(--foreground));
    font-family: monospace;
    word-break: break-all;
}

.note-actions {
    flex-shrink: 0;
    display: flex;
    gap: 0.5rem;
}

.edit-hint {
    margin: 0;
    font-size: 0.8125rem;
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
    padding: 0.5rem 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid hsl(var(--input));
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    transition: all 0.15s;

    &:focus {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
        border-color: hsl(var(--ring));
    }

    &::placeholder {
        color: hsl(var(--muted-foreground));
    }
}

textarea.todo-input {
    resize: vertical;
    min-height: 5rem;
    font-family: inherit;
    line-height: 1.5;
}

.dialog-content-wide {
    max-width: 720px;
    width: 100%;
}

.audit-note-title {
    font-weight: 400;
    color: hsl(var(--muted-foreground));
}

.audit-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 60vh;
    overflow-y: auto;
}

.audit-entry {
    padding: 1rem;
}

.audit-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}

.action-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    border-radius: 9999px;
    background-color: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
}

.action-create {
    background-color: hsl(142 71% 45% / 0.2);
    color: hsl(142 71% 45%);
}

.action-update {
    background-color: hsl(var(--primary) / 0.2);
    color: hsl(var(--primary));
}

.action-delete {
    background-color: hsl(var(--destructive) / 0.2);
    color: hsl(var(--destructive));
}

.audit-entry-date {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
}

.audit-json {
    margin: 0;
    padding: 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--muted) / 0.4);
    color: hsl(var(--foreground));
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
}
</style>
