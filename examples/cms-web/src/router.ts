import { buildAuthenticatedGuard } from '@trailmix-cms/vue';
import type { RouteRecordRaw } from 'vue-router';

export const RouteName = {
    Login: 'login',
    Dashboard: 'dashboard',
    Admin: 'admin',
    Organizations: 'organizations',
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
                path: '/',
                name: RouteName.Dashboard,
                component: () => import('@/views/authenticated/Dashboard.vue'),
            },
            {
                path: '/admin',
                name: RouteName.Admin,
                component: () => import('@/views/authenticated/Admin.vue'),
            },
            {
                path: '/organizations',
                name: RouteName.Organizations,
                component: () => import('@/views/authenticated/Organizations.vue'),
            },
        ],
    },
    {
        path: '/',
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
