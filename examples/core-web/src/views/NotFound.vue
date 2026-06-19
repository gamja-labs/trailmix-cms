<template>
    <div class="not-found-container">
        <div class="not-found-content">
            <div class="error-code">404</div>
            <h1 class="error-title">Page Not Found</h1>
            <p class="error-description">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <div class="error-actions">
                <button class="btn btn-primary" @click="goHome">
                    Go to Home
                </button>
                <button class="btn btn-outline" @click="goBack">
                    Go Back
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const goHome = () => {
    router.push('/');
};

const goBack = () => {
    router.go(-1);
};
</script>

<style scoped lang="scss">
.not-found-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(to bottom right, hsl(var(--muted)), hsl(var(--background)));
}

.not-found-content {
    text-align: center;
    max-width: 600px;
}

.error-code {
    font-size: 8rem;
    font-weight: 900;
    line-height: 1;
    color: hsl(var(--muted-foreground));
    margin-bottom: 1rem;
}

.error-title {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: hsl(var(--foreground));
}

.error-description {
    font-size: 1.125rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 2rem;
}

.error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;

}

.btn-primary {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));

    &:hover {
        background-color: hsl(var(--primary) / 0.9);
    }
}

.btn-outline {
    background-color: transparent;
    color: hsl(var(--foreground));
    border-color: hsl(var(--border));

    &:hover {
        background-color: hsl(var(--muted));
    }
}
</style>

