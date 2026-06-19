<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';
import { authClient } from '@/lib/auth';
import { RouteName } from '@/router';

const router = useRouter();

// better-auth's Vue client: a reactive ref of `{ data, isPending, error }`. `data` holds the
// current `{ user, session }` (or null when signed out).
const session = authClient.useSession();

const signOut = async () => {
    await authClient.signOut();
    router.push({ name: RouteName.Login });
};
</script>

<template>
    <div class="authenticated-layout">
        <header class="layout-header">
            <div class="header-content">
                <div class="header-left">
                    <router-link :to="{ name: RouteName.Dashboard }" class="logo-link">
                        <h1 class="logo">Trailmix Core</h1>
                    </router-link>
                    <nav class="header-nav">
                        <router-link :to="{ name: RouteName.Dashboard }" class="nav-link">
                            Dashboard
                        </router-link>
                        <router-link :to="{ name: RouteName.Notes }" class="nav-link">
                            Notes
                        </router-link>
                        <router-link :to="{ name: RouteName.Admin }" class="nav-link">
                            Admin
                        </router-link>
                    </nav>
                </div>
                <div class="header-right">
                    <ClientOnly>
                        <div class="user-info">
                            <span class="user-name">
                                {{ session?.data?.user?.name || session?.data?.user?.email || 'User' }}
                            </span>
                            <button class="btn btn-outline btn-sm" @click="signOut">Sign out</button>
                        </div>
                    </ClientOnly>
                </div>
            </div>
        </header>
        <main class="layout-main">
            <RouterView />
        </main>
    </div>
</template>

<style scoped lang="scss">
.authenticated-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: hsl(var(--background));
}

.layout-header {
    border-bottom: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 2rem;
}

.header-nav {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.nav-link {
    padding: 0.5rem 1rem;
    text-decoration: none;
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: calc(var(--radius) - 2px);
    transition: all 0.2s;

    &:hover {
        color: hsl(var(--foreground));
        background-color: hsl(var(--accent));
    }

    &.router-link-active {
        color: hsl(var(--foreground));
        background-color: hsl(var(--accent));
    }
}

.logo-link {
    text-decoration: none;
    color: inherit;

    &:hover {
        opacity: 0.8;
    }
}

.logo {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
}

.user-name {
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    font-weight: 500;
}

.layout-main {
    flex: 1;
    padding: 2rem;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
}
</style>
