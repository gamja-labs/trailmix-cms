import {
    Api,
    type StatusResponseDtoOutput,
    type GreetingResponseDtoOutput,
    type MeResponseDto,
    type AdminOverviewResponseDtoOutput,
    type ActiveOrgSettingsResponseDtoOutput,
} from '@/client/Api';

/**
 * The auto-generated, type-safe core-api client.
 *
 * Unlike a bearer-token setup, core-api uses **cookie** sessions (better-auth). We don't need a
 * `securityWorker` to attach an `Authorization` header — we just send credentials with every
 * request via `baseApiParams.credentials = 'include'`, so the browser includes the better-auth
 * session cookie. The server's CORS config echoes our origin and sets
 * `Access-Control-Allow-Credentials: true`, which is required for credentialed cross-origin calls.
 *
 * Every core-api route now declares a `@ZodResponse` DTO, so the generator emits a per-endpoint
 * response format and `.data` comes back strongly typed. `format: 'json'` stays as a harmless
 * baseline so any future route added without its own format still has its body parsed.
 */
export function useApi() {
    const api = new Api({
        baseUrl: import.meta.env.VITE_SERVICE_HOST,
        baseApiParams: {
            credentials: 'include',
            format: 'json',
        },
    });

    return {
        api,
    };
}

// Each route declares a `@ZodResponse` DTO, so its response type comes straight from the generated
// client. These aliases keep the call sites' intent readable without re-declaring the shapes.

/** `GET /status` — public health check. */
export type ApiStatus = StatusResponseDtoOutput;

/** `GET /public/greeting` — personalized when a session is present, generic otherwise. */
export type Greeting = GreetingResponseDtoOutput;

/** `GET /me` — the current better-auth user and session (session required). */
export type SessionInfo = MeResponseDto;

/** `GET /admin/overview` — system-admin only (`@Roles(['admin'])`). */
export type AdminOverview = AdminOverviewResponseDtoOutput;

/** `GET /organizations/active/settings` — org owner/admin only (`@OrgRoles(['owner', 'admin'])`). */
export type ActiveOrgSettings = ActiveOrgSettingsResponseDtoOutput;

/**
 * Turn a rejected core-api call into a readable string. The generated client throws either the
 * failed `HttpResponse` (HTTP errors — has `.status` and a parsed `.error` body, e.g. a 403 from a
 * role guard) or a plain `Error` (network / CORS failures — `fetch` itself rejected, e.g. when
 * core-api is down). Surfacing this is the difference between a blank card and knowing the API
 * returned a 403 vs. never answered.
 */
export function describeApiError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object') {
        const r = err as { status?: number; statusText?: string; error?: { message?: string } };
        if (r.error?.message) return r.error.message;
        if (typeof r.status === 'number') return `HTTP ${r.status} ${r.statusText ?? ''}`.trim();
    }
    return 'Unknown error';
}
