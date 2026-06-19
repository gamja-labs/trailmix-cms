<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Admin | Trailmix Core',
})

import { ref, onMounted } from 'vue';
import { useApi, describeApiError, type AdminOverview, type ActiveOrgSettings } from '@/lib/api';

const { api } = useApi();

// Both endpoints sit behind the same global `AuthGuard` as the rest of the app (so you must be
// signed in to reach this page at all), but each adds a *role* check on the server:
//   - `GET /admin/overview`            → `@Roles(['admin'])`            (system-admin, better-auth admin plugin)
//   - `GET /organizations/active/settings` → `@OrgRoles(['owner','admin'])` (role in the active organization)
// A signed-in user without the role gets a 403 from the server — which is exactly what these cards
// surface. Sign in as an admin to see the success payload; as a non-admin to see the guard reject.
const overview = ref<AdminOverview | null>(null);
const overviewError = ref<string | null>(null);

const orgSettings = ref<ActiveOrgSettings | null>(null);
const orgError = ref<string | null>(null);

const loading = ref(false);

const loadEverything = async () => {
    loading.value = true;
    overviewError.value = null;
    orgError.value = null;

    // Invoke the requests so they actually run, and keep both results independent: a 403 on one
    // card must not blank the other. `allSettled` waits for every call without discarding the
    // fulfilled ones the way `Promise.all` would on the first rejection.
    await Promise.allSettled([
        (async () => {
            try {
                overview.value = (await api.admin.adminControllerOverview()).data;
            } catch (err) {
                overview.value = null;
                overviewError.value = describeApiError(err);
            }
        })(),
        (async () => {
            try {
                orgSettings.value = (await api.organizations.organizationsControllerActiveSettings()).data;
            } catch (err) {
                orgSettings.value = null;
                orgError.value = describeApiError(err);
            }
        })(),
    ]);

    loading.value = false;
};

// Test-only: flip the current user's admin role via core-api's `/test/*` routes, then re-read the
// role-gated cards so the change shows immediately. The server writes the role through better-auth's
// internal adapter (the admin plugin's own `setRole` can't bootstrap your first admin).
const roleBusy = ref(false);
const roleStatus = ref<string | null>(null);
const roleError = ref<string | null>(null);

const changeRole = async (action: 'promote' | 'demote') => {
    roleBusy.value = true;
    roleStatus.value = null;
    roleError.value = null;
    try {
        const res = action === 'promote'
            ? await api.test.devControllerPromote()
            : await api.test.devControllerDemote();
        roleStatus.value = res.data.message;
        await loadEverything();
    } catch (err) {
        roleError.value = describeApiError(err);
    } finally {
        roleBusy.value = false;
    }
};

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

onMounted(loadEverything);
</script>

<template>
    <div class="admin">
        <div class="section-header">
            <h1 class="admin-title">Admin & roles</h1>
            <button class="btn btn-outline btn-sm" @click="loadEverything" :disabled="loading">
                {{ loading ? 'Loading...' : 'Refresh' }}
            </button>
        </div>

        <p class="text-muted admin-intro">
            You're already signed in (the route requires it), but these endpoints add a
            <strong>server-side role check</strong> on top. A signed-in user without the role gets a
            <code>403</code> — shown right in the card. Sign in as an admin to see the payload.
        </p>

        <div class="card test-card">
            <div class="card-header">
                <h2 class="card-title">Test: toggle your admin role</h2>
                <p class="card-description">
                    <code>POST /test/promote-admin</code> · <code>POST /test/demote-admin</code> · test-only, no role
                    guard
                </p>
            </div>
            <div class="card-content">
                <div class="test-actions">
                    <button class="btn btn-primary btn-sm" @click="changeRole('promote')" :disabled="roleBusy">
                        Promote me to admin
                    </button>
                    <button class="btn btn-outline btn-sm" @click="changeRole('demote')" :disabled="roleBusy">
                        Demote me
                    </button>
                </div>
                <p v-if="roleStatus" class="text-muted test-status">{{ roleStatus }}</p>
                <p v-if="roleError" class="result-error test-status">{{ roleError }}</p>
            </div>
        </div>

        <div class="cards-grid">
            <div class="card info-card">
                <div class="card-header">
                    <h2 class="card-title">System admin</h2>
                    <p class="card-description"><code>GET /admin/overview</code> · <code>@Roles(['admin'])</code></p>
                </div>
                <div class="card-content">
                    <pre v-if="overview" class="result-json">{{ prettyJson(overview) }}</pre>
                    <p v-else-if="overviewError" class="result-error">{{ overviewError }}</p>
                    <span v-else class="text-muted">—</span>
                </div>
            </div>

            <div class="card info-card">
                <div class="card-header">
                    <h2 class="card-title">Organization admin</h2>
                    <p class="card-description">
                        <code>GET /organizations/active/settings</code> · <code>@OrgRoles(['owner', 'admin'])</code>
                    </p>
                </div>
                <div class="card-content">
                    <pre v-if="orgSettings" class="result-json">{{ prettyJson(orgSettings) }}</pre>
                    <p v-else-if="orgError" class="result-error">{{ orgError }}</p>
                    <span v-else class="text-muted">—</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.admin {
    width: 100%;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
}

.admin-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.admin-intro {
    margin: 0 0 1.5rem;
    font-size: 0.875rem;

    code {
        font-family: monospace;
        font-size: 0.8125rem;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
        background-color: hsl(var(--muted) / 0.5);
    }
}

.test-card {
    padding: 1.25rem;
    margin-bottom: 1rem;
}

.test-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.test-status {
    margin: 0.75rem 0 0;
    font-size: 0.8125rem;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
}

.info-card {
    padding: 1.25rem;
}

.card-header code,
.card-description code {
    font-family: monospace;
    font-size: 0.8125rem;
}

.result-json {
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
}

.result-error {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    background-color: hsl(var(--destructive) / 0.15);
    color: hsl(var(--destructive));
    font-size: 0.8125rem;
}
</style>
