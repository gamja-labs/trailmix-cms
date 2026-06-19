<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
    title: 'Dashboard | Trailmix Core',
})

import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useApi, type ApiStatus, type Greeting, type SessionInfo } from '@/lib/api';
import { RouteName } from '@/router';

const { api } = useApi();

const status = ref<ApiStatus | null>(null);
const greeting = ref<Greeting | null>(null);
const me = ref<SessionInfo | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);

const loadEverything = async () => {
    loading.value = true;
    error.value = null;

     await Promise.allSettled([
        (async () => {
            status.value = (await api.status.statusControllerStatus()).data;
        })(),
        (async () => {
            greeting.value = (await api.public.publicControllerGreeting()).data;
        })(),
        (async () => {
            me.value = (await api.me.meControllerMe()).data;
        })()
    ]);

    loading.value = false;
};

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

onMounted(async () => {
    await loadEverything();
});
</script>

<template>
    <div class="dashboard">
        <div class="section-header">
            <h1 class="dashboard-title">Dashboard</h1>
            <button class="btn btn-outline btn-sm" @click="loadEverything" :disabled="loading">
                {{ loading ? 'Loading...' : 'Refresh' }}
            </button>
        </div>

        <p class="text-muted dashboard-intro">
            These cards call core-api through the generated, type-safe client — one endpoint per
            auth style: <code>/status</code> (public), <code>/public/greeting</code> (optional auth),
            and <code>/me</code> (session required).
        </p>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <div class="cards-grid">
            <div class="card info-card">
                <div class="card-header">
                    <h2 class="card-title">API status</h2>
                    <p class="card-description"><code>GET /status</code> · public</p>
                </div>
                <div class="card-content">
                    <div v-if="status" class="status-row">
                        <span class="status-pill">{{ status.status }}</span>
                        <span class="text-muted">core-api v{{ status.version }}</span>
                    </div>
                    <span v-else class="text-muted">—</span>
                </div>
            </div>

            <div class="card info-card">
                <div class="card-header">
                    <h2 class="card-title">Greeting</h2>
                    <p class="card-description"><code>GET /public/greeting</code> · optional auth</p>
                </div>
                <div class="card-content">
                    <p v-if="greeting" class="greeting-message">{{ greeting.message }}</p>
                    <p class="text-muted greeting-sub">
                        authenticated: <strong>{{ greeting?.authenticated ?? '—' }}</strong>
                    </p>
                </div>
            </div>

            <div class="card info-card">
                <div class="card-header">
                    <h2 class="card-title">Quick links</h2>
                    <p class="card-description">Try the revisable collection</p>
                </div>
                <div class="card-content">
                    <RouterLink :to="{ name: RouteName.Notes }" class="btn btn-primary btn-sm">
                        Go to Notes →
                    </RouterLink>
                </div>
            </div>
        </div>

        <div class="card session-card">
            <div class="card-header">
                <h2 class="card-title">Current session</h2>
                <p class="card-description"><code>GET /me</code> · session required (<code>@Session</code>)</p>
            </div>
            <div class="card-content">
                <pre v-if="me" class="session-json">{{ prettyJson(me) }}</pre>
                <span v-else class="text-muted">—</span>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use '../../styles/components.scss' as *;

.dashboard {
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

.dashboard-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
}

.dashboard-intro {
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

.error-banner {
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: calc(var(--radius) - 2px);
    background-color: hsl(var(--destructive) / 0.15);
    color: hsl(var(--destructive));
    font-size: 0.875rem;
}

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.info-card {
    padding: 1.25rem;
}

.card-header code,
.card-description code {
    font-family: monospace;
    font-size: 0.8125rem;
}

.status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    border-radius: 9999px;
    background-color: hsl(142 71% 45% / 0.2);
    color: hsl(142 71% 45%);
}

.greeting-message {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: hsl(var(--foreground));
}

.greeting-sub {
    margin: 0;
    font-size: 0.8125rem;
}

.session-card {
    padding: 1.25rem;
}

.session-json {
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
    max-height: 40vh;
}
</style>
