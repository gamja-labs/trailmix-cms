import { useUser } from '@clerk/vue';
import type { NavigationGuard, NavigationGuardNext, RouteLocationRaw, RouteLocationNormalizedLoaded, RouteLocationNormalized } from 'vue-router';
import { waitForClerkJsLoaded } from './clerk.js';

export function buildAuthenticatedGuard(options: {
    unauthenticatedRoute: RouteLocationRaw;
    allowAnonymous?: false;
} | {
    allowAnonymous: true
}) {
    const guard: NavigationGuard = async (to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded) => {
        const { user, isLoaded } = useUser();
        if (!isLoaded.value) {
            console.log('Waiting for Clerk JS to load');
            await waitForClerkJsLoaded(isLoaded);
        }

        if (options.allowAnonymous) {
            return true;
        }

        // If not signed in, redirect to sign in
        if (!user.value) {
            if (!options.unauthenticatedRoute) {
                return false;
            }
            return options.unauthenticatedRoute;
        }

        return true;
    }
    return guard;
}