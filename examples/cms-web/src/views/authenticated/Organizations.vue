<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Organizations | Trailmix',
})

import { ref, onMounted } from 'vue';
import { useApi } from '@/lib/api';
import type { 
    Organization, 
    OrganizationListResponseDto,
    UpdateOrganizationDto,
    OrganizationRole,
    OrganizationRoleListResponseDto,
    AssignOrganizationRoleDto
} from '@/client/Api';

const { api } = useApi();

// Organizations
const organizations = ref<Organization[]>([]);
const organizationsLoading = ref(false);
const selectedOrganizationId = ref<string | null>(null);
const showUpdateDialog = ref(false);
const updatingOrganization = ref(false);
const updateData = ref<UpdateOrganizationDto>({
    name: '',
});

// Organization Roles
const organizationRoles = ref<OrganizationRole[]>([]);
const rolesLoading = ref(false);
const showCreateRoleDialog = ref(false);
const creatingRole = ref(false);
const newRole = ref<AssignOrganizationRoleDto>({
    organization_id: '',
    principal_id: '',
    principal_type: 'account',
    role: '',
});

const loadOrganizations = async () => {
    try {
        organizationsLoading.value = true;
        const response = await api.organizations.organizationsControllerGetOrganizations();
        organizations.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load organizations:', error);
        alert(error?.error?.message || 'Failed to load organizations');
    } finally {
        organizationsLoading.value = false;
    }
};

const loadOrganizationRoles = async (organizationId: string) => {
    try {
        rolesLoading.value = true;
        const response = await api.organizationRoles.organizationRolesControllerGetOrganizationRoleAssignments({
            organization_id: organizationId,
        });
        organizationRoles.value = response.data.items || [];
    } catch (error: any) {
        console.error('Failed to load organization roles:', error);
        alert(error?.error?.message || 'Failed to load organization roles');
    } finally {
        rolesLoading.value = false;
    }
};

const selectOrganization = async (organizationId: string) => {
    selectedOrganizationId.value = organizationId;
    await loadOrganizationRoles(organizationId);
};

const openUpdateDialog = (organization: Organization) => {
    selectedOrganizationId.value = organization._id;
    updateData.value = {
        name: organization.name,
    };
    showUpdateDialog.value = true;
};

const updateOrganization = async () => {
    if (!selectedOrganizationId.value || !updateData.value.name.trim()) {
        return;
    }

    try {
        updatingOrganization.value = true;
        await api.organizations.organizationsControllerUpdateOrganization(
            selectedOrganizationId.value,
            updateData.value
        );
        await loadOrganizations();
        showUpdateDialog.value = false;
        updateData.value = { name: '' };
    } catch (error: any) {
        console.error('Failed to update organization:', error);
        alert(error?.error?.message || 'Failed to update organization');
    } finally {
        updatingOrganization.value = false;
    }
};

const openCreateRoleDialog = () => {
    if (!selectedOrganizationId.value) {
        alert('Please select an organization first');
        return;
    }
    newRole.value = {
        organization_id: selectedOrganizationId.value,
        principal_id: '',
        principal_type: 'account',
        role: '',
    };
    showCreateRoleDialog.value = true;
};

const createOrganizationRole = async () => {
    if (!newRole.value.organization_id.trim() || !newRole.value.principal_id.trim() || !newRole.value.role.trim()) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        creatingRole.value = true;
        await api.organizationRoles.organizationRolesControllerAssignRole(newRole.value);
        if (selectedOrganizationId.value) {
            await loadOrganizationRoles(selectedOrganizationId.value);
        }
        newRole.value = {
            organization_id: selectedOrganizationId.value || '',
            principal_id: '',
            principal_type: 'account',
            role: '',
        };
        showCreateRoleDialog.value = false;
    } catch (error: any) {
        console.error('Failed to assign organization role:', error);
        alert(error?.error?.message || 'Failed to assign organization role');
    } finally {
        creatingRole.value = false;
    }
};

const removeOrganizationRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this organization role assignment?')) {
        return;
    }

    try {
        rolesLoading.value = true;
        await api.organizationRoles.organizationRolesControllerRemoveRole(roleId);
        if (selectedOrganizationId.value) {
            await loadOrganizationRoles(selectedOrganizationId.value);
        }
    } catch (error: any) {
        console.error('Failed to remove organization role:', error);
        alert(error?.error?.message || 'Failed to remove organization role');
    } finally {
        rolesLoading.value = false;
    }
};

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
};

onMounted(async () => {
    await loadOrganizations();
});
</script>

<template>
    <div class="organizations-dashboard">
        <div class="organizations-header">
            <h1 class="organizations-title">Organizations</h1>
        </div>

        <div class="organizations-layout">
            <!-- Organizations List -->
            <aside class="organizations-sidebar">
                <div class="sidebar-header">
                    <h2 class="sidebar-title">Organizations</h2>
                    <button class="btn btn-outline btn-sm" @click="loadOrganizations" :disabled="organizationsLoading">
                        {{ organizationsLoading ? 'Loading...' : 'Refresh' }}
                    </button>
                </div>
                <div v-if="organizationsLoading" class="loading-small">Loading organizations...</div>
                <div v-else-if="organizations.length === 0" class="empty-state-small">
                    <p class="text-muted">No organizations found</p>
                </div>
                <nav v-else class="organizations-nav">
                    <div
                        v-for="org in organizations"
                        :key="org._id"
                        class="organization-item"
                        :class="{ 'organization-item-active': selectedOrganizationId === org._id }"
                        @click="selectOrganization(org._id)"
                    >
                        <div class="organization-item-content">
                            <div class="organization-name">{{ org.name }}</div>
                            <div class="organization-meta">
                                <span class="organization-id">ID: {{ org._id }}</span>
                            </div>
                        </div>
                        <button
                            class="btn btn-ghost btn-xs"
                            @click.stop="openUpdateDialog(org)"
                        >
                            Edit
                        </button>
                    </div>
                </nav>
            </aside>

            <!-- Main Content -->
            <main class="organizations-main">
                <div v-if="!selectedOrganizationId" class="empty-state">
                    <p class="text-muted">Select an organization to view details and manage roles.</p>
                </div>

                <template v-else>
                    <div class="section-header">
                        <h2 class="section-title">Organization Roles</h2>
                        <div class="section-actions">
                            <button class="btn btn-outline btn-sm" @click="loadOrganizationRoles(selectedOrganizationId)" :disabled="rolesLoading">
                                {{ rolesLoading ? 'Loading...' : 'Refresh' }}
                            </button>
                            <button class="btn btn-primary btn-sm" @click="openCreateRoleDialog">
                                + Assign Role
                            </button>
                        </div>
                    </div>

                    <!-- Roles List -->
                    <div v-if="rolesLoading" class="loading">
                        Loading organization roles...
                    </div>
                    <div v-else-if="organizationRoles.length === 0" class="empty-state">
                        <p class="text-muted">No roles assigned to this organization.</p>
                    </div>
                    <div v-else class="roles-list">
                        <div
                            v-for="role in organizationRoles"
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
                                        @click="removeOrganizationRole(role._id)"
                                        :disabled="rolesLoading"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </main>
        </div>

        <!-- Update Organization Dialog -->
        <div v-if="showUpdateDialog" class="dialog-overlay" @click.self="showUpdateDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">Update Organization</h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="org-name">Organization Name *</label>
                        <input
                            id="org-name"
                            v-model="updateData.name"
                            type="text"
                            placeholder="Enter organization name"
                            class="todo-input"
                            @keyup.enter="updateOrganization"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showUpdateDialog = false">Cancel</button>
                    <button 
                        class="btn btn-primary" 
                        @click="updateOrganization" 
                        :disabled="updatingOrganization || !updateData.name.trim()"
                    >
                        {{ updatingOrganization ? 'Updating...' : 'Update' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Create Role Dialog -->
        <div v-if="showCreateRoleDialog" class="dialog-overlay" @click.self="showCreateRoleDialog = false">
            <div class="dialog-content">
                <div class="dialog-header">
                    <h2 class="dialog-title">Assign Organization Role</h2>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="new-role-org-id">Organization ID *</label>
                        <input
                            id="new-role-org-id"
                            v-model="newRole.organization_id"
                            type="text"
                            placeholder="Enter organization ID (MongoDB ObjectId)"
                            class="todo-input"
                            readonly
                        />
                    </div>
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
                            placeholder="Enter role name (e.g., admin, user, reader)"
                            class="todo-input"
                        />
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-outline" @click="showCreateRoleDialog = false">Cancel</button>
                    <button 
                        class="btn btn-primary" 
                        @click="createOrganizationRole" 
                        :disabled="creatingRole || !newRole.organization_id.trim() || !newRole.principal_id.trim() || !newRole.role.trim()"
                    >
                        {{ creatingRole ? 'Assigning...' : 'Assign Role' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.organizations-dashboard {
    width: 100%;
}

.organizations-header {
    margin-bottom: 2rem;
}

.organizations-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.organizations-layout {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
}

.organizations-sidebar {
    width: 300px;
    flex-shrink: 0;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    padding: 1.5rem;
    position: sticky;
    top: 2rem;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
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

.organizations-nav {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.organization-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    text-align: left;
    border: none;
    background: transparent;
    color: hsl(var(--foreground));
    border-radius: calc(var(--radius) - 2px);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    gap: 0.5rem;

    &:hover {
        background-color: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
    }

    &.organization-item-active {
        background-color: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-weight: 500;
    }
}

.organization-item-content {
    flex: 1;
    min-width: 0;
}

.organization-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
}

.organization-meta {
    font-size: 0.75rem;
    opacity: 0.8;
}

.organization-id {
    font-family: monospace;
}

.organizations-main {
    flex: 1;
    min-width: 0;
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

.loading,
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
}

.roles-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.role-item {
    padding: 1.5rem;
    transition: all 0.2s;

    &:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
    }
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

.btn-xs {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
}
</style>
