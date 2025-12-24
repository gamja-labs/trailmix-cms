import { useUser } from '@clerk/vue';
import type { NavigationGuard, NavigationGuardNext, RouteLocationRaw, RouteLocationNormalizedLoaded, RouteLocationNormalized } from 'vue-router';
import { waitForClerkJsLoaded } from './clerk.js';

export function buildAuthenticatedGuard(options: {
    unauthenticatedRoute: RouteLocationRaw;
    allowAnonymous?: boolean;
}) {
    const guard: NavigationGuard = async (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded, next: NavigationGuardNext) => {
        const { user, isLoaded } = useUser();
        if (!isLoaded.value) {
            console.log('Waiting for Clerk JS to load');
            await waitForClerkJsLoaded(isLoaded);
        }

        if (options.allowAnonymous) {
            next();
            return;
        }

        // If not signed in, redirect to sign in
        if (!user.value) {
            next(options.unauthenticatedRoute);
            return;
        }

        next();
    }
    return guard;
}