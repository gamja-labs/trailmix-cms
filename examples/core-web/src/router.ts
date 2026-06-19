import type { RouteRecordRaw } from 'vue-router';
import { buildAuthenticatedGuard } from '@/lib/guard';

export const RouteName = {
    Login: 'login',
    Dashboard: 'dashboard',
    Notes: 'notes',
    Admin: 'admin',
} as const;

export const authenticatedGuard = buildAuthenticatedGuard({
    unauthenticatedRoute: {
        name: RouteName.Login,
    },
});

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: () => import('@/views/authenticated/Layout.vue'),
        beforeEnter: authenticatedGuard,
        children: [
            {
                path: '',
                name: RouteName.Dashboard,
                component: () => import('@/views/authenticated/Dashboard.vue'),
            },
            {
                path: 'notes',
                name: RouteName.Notes,
                component: () => import('@/views/authenticated/Notes.vue'),
            },
            {
                // Requires a session to reach (the layout's guard), then the server's role guard
                // decides admin vs. 403 — demonstrating server-side RBAC, not a client-side gate.
                path: 'admin',
                name: RouteName.Admin,
                component: () => import('@/views/authenticated/Admin.vue'),
            },
        ],
    },
    {
        path: '/login',
        name: RouteName.Login,
        component: () => import('@/views/Login.vue'),
        meta: { requiresAuth: false },
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFound.vue'),
        meta: { requiresAuth: false },
    },
];
