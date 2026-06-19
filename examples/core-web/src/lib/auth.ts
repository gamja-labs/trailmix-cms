import { createAuthClient } from 'better-auth/vue';
import { adminClient, organizationClient } from 'better-auth/client/plugins';

/**
 * The better-auth client, pointed at the core-api. better-auth mounts its routes under
 * `/api/auth` on the server (see core-api's `setupTrailmixAuth`), and the client appends that
 * path to `baseURL` automatically — so `VITE_SERVICE_HOST` is just the API origin.
 *
 * The `organizationClient` / `adminClient` plugins mirror the `organization` / `admin` plugins
 * enabled on the server, giving typed access to `authClient.organization.*` and
 * `authClient.admin.*` should you want to build on the org/admin endpoints.
 *
 * Auth is **cookie-based**: signing in sets a session cookie on the API origin. Requests that
 * carry credentials (the better-auth client does this for you, and our generated API client is
 * configured with `credentials: 'include'` in `lib/api.ts`) are then authenticated. The API must
 * allow that origin with credentials — core-api's CORS + better-auth `trustedOrigins` are wired
 * for `http://localhost:5175` out of the box.
 */
export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_SERVICE_HOST,
    plugins: [organizationClient(), adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
