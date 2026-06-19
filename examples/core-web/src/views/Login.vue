<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authClient } from '@/lib/auth';
import { useApi, describeApiError, type ApiStatus, type Greeting } from '@/lib/api';
import { RouteName } from '@/router';

useHead({
    title: 'Sign in | Trailmix Core',
})

const router = useRouter();

// Even on the login page — with no session — core-api still answers its non-protected routes:
//   - `GET /status`          → `@AllowAnonymous()` (public health check)
//   - `GET /public/greeting` → `@OptionalAuth()` (works signed-out; just isn't personalized)
// We fetch both on mount to prove the guard styles behave when unauthenticated. `/public/greeting`
// comes back with `authenticated: false` here; sign in and the Dashboard shows it personalized.
const { api } = useApi();

const status = ref<ApiStatus | null>(null);
const greeting = ref<Greeting | null>(null);
const publicError = ref<string | null>(null);

const loadPublic = async () => {
    publicError.value = null;
    try {
        const [statusRes, greetingRes] = await Promise.all([
            api.status.statusControllerStatus(),
            api.public.publicControllerGreeting(),
        ]);
        status.value = statusRes.data;
        greeting.value = greetingRes.data;
    } catch (err) {
        publicError.value = describeApiError(err);
    }
};

onMounted(loadPublic);

const mode = ref<'sign-in' | 'sign-up'>('sign-in');
const name = ref('');
const email = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const toggleMode = () => {
    mode.value = mode.value === 'sign-in' ? 'sign-up' : 'sign-in';
    error.value = null;
};

const submit = async () => {
    error.value = null;
    if (!email.value || !password.value || (mode.value === 'sign-up' && !name.value)) {
        error.value = 'Please fill in all fields.';
        return;
    }

    submitting.value = true;
    try {
        const result = mode.value === 'sign-in'
            ? await authClient.signIn.email({ email: email.value, password: password.value })
            : await authClient.signUp.email({ name: name.value, email: email.value, password: password.value });

        if (result.error) {
            error.value = result.error.message || 'Authentication failed.';
            return;
        }

        router.push({ name: RouteName.Dashboard });
    } catch (e: any) {
        console.error('Auth error:', e);
        error.value = e?.message || 'Something went wrong.';
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <div class="login-container">
        <ClientOnly>
            <div class="login-card">
                <div class="login-card-header">
                    <h1 class="login-title">Trailmix Core</h1>
                    <p class="login-description">
                        {{ mode === 'sign-in' ? 'Sign in to your account to continue' : 'Create an account to get started' }}
                    </p>
                </div>
                <form class="login-card-content" @submit.prevent="submit">
                    <div v-if="mode === 'sign-up'" class="form-group">
                        <label for="name">Name</label>
                        <input id="name" v-model="name" type="text" autocomplete="name" placeholder="Ada Lovelace"
                            class="text-input" />
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input id="email" v-model="email" type="email" autocomplete="email" placeholder="you@example.com"
                            class="text-input" />
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input id="password" v-model="password" type="password"
                            :autocomplete="mode === 'sign-in' ? 'current-password' : 'new-password'"
                            placeholder="••••••••" class="text-input" />
                    </div>

                    <p v-if="error" class="login-error">{{ error }}</p>

                    <button type="submit" class="login-button" :disabled="submitting">
                        {{ submitting ? 'Please wait…' : (mode === 'sign-in' ? 'Sign in' : 'Create account') }}
                    </button>

                    <p class="login-toggle">
                        {{ mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?' }}
                        <button type="button" class="login-toggle-link" @click="toggleMode">
                            {{ mode === 'sign-in' ? 'Sign up' : 'Sign in' }}
                        </button>
                    </p>
                </form>
            </div>

            <div class="public-card">
                <p class="public-card-title">core-api — signed out</p>
                <p class="public-card-sub">These routes answer without a session:</p>
                <div v-if="publicError" class="public-error">{{ publicError }}</div>
                <dl class="public-list">
                    <div class="public-row">
                        <dt><code>GET /status</code></dt>
                        <dd>
                            <template v-if="status">{{ status.status }} · v{{ status.version }}</template>
                            <span v-else class="text-muted">—</span>
                        </dd>
                    </div>
                    <div class="public-row">
                        <dt><code>GET /public/greeting</code></dt>
                        <dd>
                            <template v-if="greeting">
                                authenticated: <strong>{{ greeting.authenticated }}</strong> · {{ greeting.message }}
                            </template>
                            <span v-else class="text-muted">—</span>
                        </dd>
                    </div>
                </dl>
            </div>
        </ClientOnly>
    </div>
</template>

<style scoped lang="scss">
@use '../styles/components.scss' as *;

.login-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    background: linear-gradient(135deg, hsl(var(--muted) / 0.2), hsl(var(--background)));
}

.login-card {
    @extend .card;
    width: 100%;
    max-width: 400px;
    padding: 0;
    overflow: hidden;
}

.login-card-header {
    @extend .card-header;
    text-align: center;
    padding: 1.5rem;
}

.login-title {
    @extend .card-title;
    margin: 0;
    font-size: 1.875rem;
    font-weight: 600;
    letter-spacing: -0.025em;
}

.login-description {
    @extend .card-description;
    margin-top: 0.75rem;
    margin-bottom: 0;
    font-size: 0.9375rem;
}

.login-card-content {
    @extend .card-content;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;

    label {
        font-size: 0.875rem;
        font-weight: 500;
        color: hsl(var(--foreground));
    }
}

.text-input {
    width: 100%;
    padding: 0.55rem 0.75rem;
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

.login-error {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    background-color: hsl(var(--destructive) / 0.15);
    color: hsl(var(--destructive));
    font-size: 0.8125rem;
}

.login-button {
    @extend .btn;
    @extend .btn-primary;
    width: 100%;
    padding: 0.75rem 1.5rem;
    font-size: 0.9375rem;
    font-weight: 500;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover:not(:disabled) {
        opacity: 0.95;
    }
}

.login-toggle {
    margin: 0;
    text-align: center;
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
}

.login-toggle-link {
    background: none;
    border: none;
    padding: 0;
    color: hsl(var(--primary));
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
}

.public-card {
    @extend .card;
    width: 100%;
    max-width: 400px;
    padding: 1.25rem 1.5rem;
}

.public-card-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.public-card-sub {
    margin: 0.25rem 0 0.75rem;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
}

.public-error {
    margin-bottom: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-radius: calc(var(--radius) - 2px);
    background-color: hsl(var(--destructive) / 0.15);
    color: hsl(var(--destructive));
    font-size: 0.8125rem;
}

.public-list {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.public-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;

    dt code {
        font-family: monospace;
        font-size: 0.8125rem;
        color: hsl(var(--muted-foreground));
    }

    dd {
        margin: 0;
        font-size: 0.875rem;
        color: hsl(var(--foreground));
    }
}
</style>
