import type { NavigationGuard, RouteLocationRaw } from 'vue-router';
import { authClient } from './auth';

/**
 * A vue-router navigation guard that requires a better-auth session. Mirrors the Clerk-based
 * `buildAuthenticatedGuard` from `@trailmix-cms/vue`, but checks better-auth instead.
 *
 * `authClient.getSession()` reads the session from the API (using the session cookie). When there
 * is no session we redirect to `unauthenticatedRoute`.
 */
export function buildAuthenticatedGuard(options: { unauthenticatedRoute: RouteLocationRaw }) {
    const guard: NavigationGuard = async () => {
        // vite-ssg prerenders routes on the server, where there is no browser cookie to read.
        // Let the static shell render; the guard re-runs on the client after hydration.
        if (import.meta.env.SSR) {
            return true;
        }

        const { data: session } = await authClient.getSession();
        if (!session) {
            return options.unauthenticatedRoute;
        }

        return true;
    };

    return guard;
}
