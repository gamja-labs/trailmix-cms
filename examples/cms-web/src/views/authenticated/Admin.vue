<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Admin | Trailmix',
})

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '@/lib/api';
import { RouteName } from '@/router';
import type { 
    SecurityAudit, 
    SecurityAuditListResponseDto,
    GlobalRole,
    GlobalRoleListResponseDto,
    AssignGlobalRoleDto
} from '@/client/Api';

const { api } = useApi();
const router = useRouter();

// Access control
const hasAdminAccess = ref(false);
const checkingAccess = ref(true);

// Tab management
const activeTab = ref<'audits' | 'roles'>('audits');

// Security Audits
const securityAudits = ref<SecurityAudit[]>([]);
const auditsLoading = ref(false);
const auditFilters = ref({
    principal_id: '',
    principal_type: '' as '' | 'account' | 'api_key',
    event_type: '' as '' | 'unauthorized_access',
});

// Global Roles
const globalRoles = ref<GlobalRole[]>([]);
const rolesLoading = ref(false);
const showCreateRoleDialog = ref(false);
const newRole = ref<AssignGlobalRoleDto>({
    principal_id: '',
    principal_type: 'account',
    role: '',
});
const creatingRole = ref(false);
const roleFilters = ref({
    principal_id: '',
    principal_type: '' as '' | 'account' | 'api_key',
    role: '',
});

const loadSecurityAudits = async () => {
    try {
        auditsLoading.value = true;
        const query: any = {};
        if (auditFilters.value.principal_id) {
            query.principal_id = auditFilters.value.principal_id;
        }
        if (auditFilters.value.principal_type) {
            query.principal_type = auditFilters.value.principal_type;
        }
        if (auditFilters.value.event_type) {
            query.event_type = auditFilters.value.event_type;
        }
        
        const response = await api.securityAudits.securityAuditsControllerGetSecurityAudits(
            Object.keys(query).length > 0 ? query : undefined
        );
        securityAudits.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load security audits:', error);
        alert(error?.error?.message || 'Failed to load security audits');
    } finally {
        auditsLoading.value = false;
    }
};

const loadGlobalRoles = async () => {
    try {
        rolesLoading.value = true;
        const query: any = {};
        if (roleFilters.value.principal_id) {
            query.principal_id = roleFilters.value.principal_id;
        }
        if (roleFilters.value.principal_type) {
            query.principal_type = roleFilters.value.principal_type;
        }
        if (roleFilters.value.role) {
            query.role = roleFilters.value.role;
        }
        
        const response = await api.globalRoles.globalRolesControllerGetGlobalRoleAssignments(
            Object.keys(query).length > 0 ? query : undefined
        );
        globalRoles.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load global roles:', error);
        alert(error?.error?.message || 'Failed to load global roles');
    } finally {
        rolesLoading.value = false;
    }
};

const createGlobalRole = async () => {
    if (!newRole.value.principal_id.trim() || !newRole.value.role.trim()) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        creatingRole.value = true;
        await api.globalRoles.globalRolesControllerAssignRole(newRole.value);
        await loadGlobalRoles();
        newRole.value = {
            principal_id: '',
            principal_type: 'account',
            role: '',
        };
        showCreateRoleDialog.value = false;
    } catch (error: any) {
        console.error('Failed to create global role:', error);
        alert(error?.error?.message || 'Failed to create global role');
    } finally {
        creatingRole.value = false;
    }
};

const removeGlobalRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this global role assignment?')) {
        return;
    }

    try {
        rolesLoading.value = true;
        await api.globalRoles.globalRolesControllerRemoveRole(roleId);
        await loadGlobalRoles();
    } catch (error: any) {
        console.error('Failed to remove global role:', error);
        alert(error?.error?.message || 'Failed to remove global role');
    } finally {
        rolesLoading.value = false;
    }
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
};

const checkAdminAccess = async () => {
    try {
        checkingAccess.value = true;
        const response = await api.account.accountControllerGetGlobalRoles();
        const roles = response.data.items || [];
        const isAdmin = roles.some(role => role.role === 'admin');
        
        if (!isAdmin) {
            alert('Access denied. You must have the global admin role to access this page.');
            router.push({ name: RouteName.Dashboard });
            return;
        }
        
        hasAdminAccess.value = true;
        await loadSecurityAudits();
        await loadGlobalRoles();
    } catch (error: any) {
        console.error('Failed to check admin access:', error);
        alert(error?.error?.message || 'Failed to verify admin access');
        router.push({ name: RouteName.Dashboard });
    } finally {
        checkingAccess.value = false;
    }
};

onMounted(async () => {
    await checkAdminAccess();
});
</script>

<template>
    <div class="admin-dashboard">
        <div v-if="checkingAccess" class="loading">
            <p>Checking admin access...</p>
        </div>
        <template v-else-if="hasAdminAccess">
            <div class="admin-header">
                <h1 class="admin-title">Admin Interface</h1>
            </div>

        <!-- Tabs -->
        <div class="tabs">
            <button
                class="tab-button"
                :class="{ 'tab-active': activeTab === 'audits' }"
                @click="activeTab = 'audits'"
            >
                Security Audits
            </button>
            <button
                class="tab-button"
                :class="{ 'tab-active': activeTab === 'roles' }"
                @click="activeTab = 'roles'"
            >
                Global Roles
            </button>
        </div>

        <!-- Security Audits Tab -->
        <div v-if="activeTab === 'audits'" class="tab-content">
            <div class="section-header">
                <h2 class="section-title">Security Audits</h2>
                <button class="btn btn-outline btn-sm" @click="loadSecurityAudits" :disabled="auditsLoading">
                    {{ auditsLoading ? 'Loading...' : 'Refresh' }}
                </button>
            </div>

            <!-- Filters -->
            <div class="filters card">
                <h3 class="filters-title">Filters</h3>
                <div class="filters-grid">
                    <div class="form-group">
                        <label for="audit-principal-id">Principal ID</label>
                        <input
                            id="audit-principal-id"
                            v-model="auditFilters.principal_id"
                            type="text"
                            placeholder="Filter by principal ID"
                            class="todo-input"
                        />
                    </div>
                    <div class="form-group">
                        <label for="audit-principal-type">Principal Type</label>
                        <select
                            id="audit-principal-type"
                            v-model="auditFilters.principal_type"
                            class="todo-input"
                        >
                            <option value="">All</option>
                            <option value="account">Account</option>
                            <option value="api_key">API Key</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="audit-event-type">Event Type</label>
                        <select
                            id="audit-event-type"
                            v-model="auditFilters.event_type"
                            class="todo-input"
                        >
                            <option value="">All</option>
                            <option value="unauthorized_access">Unauthorized Access</option>
                        </select>
                    </div>
                </div>
                <div class="filters-actions">
                    <button class="btn btn-primary" @click="loadSecurityAudits" :disabled="auditsLoading">
                        Apply Filters
                    </button>
                    <button class="btn btn-outline" @click="auditFilters = { principal_id: '', principal_type: '', event_type: '' }; loadSecurityAudits()">
                        Clear
                    </button>
                </div>
            </div>

            <!-- Audits List -->
            <div v-if="auditsLoading" class="loading">
                Loading security audits...
            </div>
            <div v-else-if="securityAudits.length === 0" class="empty-state">
                <p class="text-muted">No security audits found.</p>
            </div>
            <div v-else class="audits-list">
                <div
                    v-for="audit in securityAudits"
                    :key="audit._id"
                    class="audit-item card"
                >
                    <div class="audit-header">
                        <div class="audit-meta">
                            <span class="audit-id">ID: {{ audit._id }}</span>
                            <span class="audit-date">{{ formatDate(audit.created_at) }}</span>
                        </div>
                        <span class="audit-event-type">{{ audit.event_type }}</span>
                    </div>
                    <div class="audit-details">
                        <div class="audit-detail-row">
                            <span class="audit-label">Principal Type:</span>
                            <span class="audit-value">{{ audit.principal_type }}</span>
                        </div>
                        <div class="audit-detail-row">
                            <span class="audit-label">Principal ID:</span>
                            <span class="audit-value">{{ audit.principal_id }}</span>
                        </div>
                        <div v-if="audit.message" class="audit-detail-row">
                            <span class="audit-label">Message:</span>
                            <span class="audit-value">{{ audit.message }}</span>
                        </div>
                        <div v-if="audit.source" class="audit-detail-row">
                            <span class="audit-label">Source:</span>
                            <span class="audit-value">{{ audit.source }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Global Roles Tab -->
        <div v-if="activeTab === 'roles'" class="tab-content">
            <div class="section-header">
                <h2 class="section-title">Global Roles</h2>
                <div class="section-actions">
                    <button class="btn btn-outline btn-sm" @click="loadGlobalRoles" :disabled="rolesLoading">
                        {{ rolesLoading ? 'Loading...' : 'Refresh' }}
                    </button>
                    <button class="btn btn-primary btn-sm" @click="showCreateRoleDialog = true">
                        + Assign Role
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="filters card">
                <h3 class="filters-title">Filters</h3>
                <div class="filters-grid">
                    <div class="form-group">
                        <label for="role-principal-id">Principal ID</label>
                        <input
                            id="role-principal-id"
                            v-model="roleFilters.principal_id"
                            type="text"
                            placeholder="Filter by principal ID"
                            class="todo-input"
                        />
                    </div>
                    <div class="form-group">
                        <label for="role-principal-type">Principal Type</label>
                        <select
                            id="role-principal-type"
                            v-model="roleFilters.principal_type"
                            class="todo-input"
                        >
                            <option value="">All</option>
                            <option value="account">Account</option>
                            <option value="api_key">API Key</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="role-name">Role</label>
                        <input
                            id="role-name"
                            v-model="roleFilters.role"
                            type="text"
                            placeholder="Filter by role name"
                            class="todo-input"
                        />
                    </div>
                </div>
                <div class="filters-actions">
                    <button class="btn btn-primary" @click="loadGlobalRoles" :disabled="rolesLoading">
                        Apply Filters
                    </button>
                    <button class="btn btn-outline" @click="roleFilters = { principal_id: '', principal_type: '', role: '' }; loadGlobalRoles()">
                        Clear
                    </button>
                </div>
            </div>

            <!-- Roles List -->
            <div v-if="rolesLoading" class="loading">
                Loading global roles...
            </div>
            <div v-else-if="globalRoles.length === 0" class="empty-state">
                <p class="text-muted">No global roles found.</p>
            </div>
            <div v-else class="roles-list">
                <div
                    v-for="role in globalRoles"
                    :key="role._id"
                    class="role-item card"
                >
                    <div class="role-content">
                        <div class="role-info">
                            <div class="role-header">
                                <span class="role-name">{{ role.role }}</span>
                                <span class="role-date">{{ formatDate(role.created_at) }}</span>
                            </div>
                            <div class="role-details">
                                <div class="role-detail-row">
                                    <span class="role-label">Principal Type:</span>
                                    <span class="role-value">{{ role.principal_type }}</span>
                                </div>
                                <div class="role-detail-row">
                                    <span class="role-label">Principal ID:</span>
                                    <span class="role-value">{{ role.principal_id }}</span>
                                </div>
                                <div class="role-detail-row">
                                    <span class="role-label">Assignment ID:</span>
                                    <span class="role-value">{{ role._id }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="role-actions">
                            <button
                                class="btn btn-destructive btn-sm"
                                @click="removeGlobalRole(role._id)"
                                :disabled="rolesLoading"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create Role Dialog -->
        <div v-if="showCreateRoleDialog" class="dialog-overlay" @click.self="showCreateRoleDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">Assign Global Role</h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="new-role-principal-id">Principal ID *</label>
                        <input
                            id="new-role-principal-id"
                            v-model="newRole.principal_id"
                            type="text"
                            placeholder="Enter principal ID (MongoDB ObjectId)"
                            class="todo-input"
                        />
                    </div>
                    <div class="form-group">
                        <label for="new-role-principal-type">Principal Type *</label>
                        <select
                            id="new-role-principal-type"
                            v-model="newRole.principal_type"
                            class="todo-input"
                        >
                            <option value="account">Account</option>
                            <option value="api_key">API Key</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="new-role-name">Role *</label>
                        <input
                            id="new-role-name"
                            v-model="newRole.role"
                            type="text"
                            placeholder="Enter role name (e.g., admin, user)"
                            class="todo-input"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showCreateRoleDialog = false">Cancel</button>
                    <button 
                        class="btn btn-primary" 
                        @click="createGlobalRole" 
                        :disabled="creatingRole || !newRole.principal_id.trim() || !newRole.role.trim()"
                    >
                        {{ creatingRole ? 'Assigning...' : 'Assign Role' }}
                    </button>
                </div>
            </div>
        </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.admin-dashboard {
    width: 100%;
}

.admin-header {
    margin-bottom: 2rem;
}

.admin-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid hsl(var(--border));
    margin-bottom: 2rem;
}

.tab-button {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        color: hsl(var(--foreground));
    }

    &.tab-active {
        color: hsl(var(--foreground));
        border-bottom-color: hsl(var(--primary));
    }
}

.tab-content {
    width: 100%;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
}

.section-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
}

.section-actions {
    display: flex;
    gap: 0.5rem;
}

.filters {
    margin-bottom: 2rem;
    padding: 1.5rem;
}

.filters-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1.25rem 0;
    color: hsl(var(--foreground));
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &::before {
        content: '';
        width: 3px;
        height: 1rem;
        background-color: hsl(var(--primary));
        border-radius: 2px;
    }
}

.filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 1.5rem;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .form-group {
        margin-bottom: 0;

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            color: hsl(var(--foreground));
        }

        .todo-input {
            width: 100%;
            padding: 0.625rem 0.75rem;
            border-radius: calc(var(--radius) - 2px);
            border: 1px solid hsl(var(--input));
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            font-size: 0.875rem;
            transition: all 0.2s;

            &:focus {
                outline: none;
                box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
                border-color: hsl(var(--ring));
            }

            &::placeholder {
                color: hsl(var(--muted-foreground));
            }

            &:hover:not(:focus) {
                border-color: hsl(var(--input) / 0.8);
            }
        }
    }
}

.filters-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid hsl(var(--border));

    @media (max-width: 768px) {
        flex-direction: column-reverse;
        
        button {
            width: 100%;
        }
    }
}

.loading,
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
}

.audits-list,
.roles-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.audit-item,
.role-item {
    padding: 1.5rem;
    transition: all 0.2s;

    &:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
    }
}

.audit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.audit-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.audit-id {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    font-family: monospace;
}

.audit-date {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
}

.audit-event-type {
    padding: 0.25rem 0.75rem;
    background-color: hsl(var(--destructive) / 0.2);
    color: hsl(var(--destructive));
    border-radius: calc(var(--radius) - 2px);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.audit-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.audit-detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.audit-label {
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    min-width: 120px;
}

.audit-value {
    color: hsl(var(--foreground));
    font-family: monospace;
    word-break: break-all;
}

.role-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
}

.role-info {
    flex: 1;
    min-width: 0;
}

.role-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    gap: 1rem;
    flex-wrap: wrap;
}

.role-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.role-date {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
}

.role-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.role-detail-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.role-label {
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    min-width: 120px;
}

.role-value {
    color: hsl(var(--foreground));
    font-family: monospace;
    word-break: break-all;
}

.role-actions {
    flex-shrink: 0;
}
</style>