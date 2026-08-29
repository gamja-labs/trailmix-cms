import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { API_URL } from '../playwright.config';

/** better-auth mounts its own routes under this prefix (see core-api's `setupTrailmixAuth`). */
const AUTH_BASE = '/api/auth';

/** Comfortably over better-auth's 8-character minimum. */
export const PASSWORD = 'Sup3rSecret!pw';

export interface Credentials {
    email: string;
    password: string;
    name?: string;
}

/**
 * A cookie-isolated HTTP client for one user.
 *
 * Auth here is cookie-based, not bearer — `APIRequestContext` keeps its own cookie jar and
 * replays `Set-Cookie` exactly as a browser would, so one context per user gives us independent
 * sessions without any manual header plumbing.
 */
export function newClient(): Promise<APIRequestContext> {
    return request.newContext({ baseURL: API_URL });
}

/** POST /api/auth/sign-up/email — better-auth auto-signs the new user in and issues the cookie. */
export function signUp(client: APIRequestContext, creds: Credentials): Promise<APIResponse> {
    return client.post(`${AUTH_BASE}/sign-up/email`, {
        data: {
            name: creds.name ?? creds.email.split('@')[0],
            email: creds.email,
            password: creds.password,
        },
        failOnStatusCode: false,
    });
}

/** POST /api/auth/sign-in/email. */
export function signIn(client: APIRequestContext, creds: Credentials): Promise<APIResponse> {
    return client.post(`${AUTH_BASE}/sign-in/email`, {
        data: { email: creds.email, password: creds.password },
        failOnStatusCode: false,
    });
}

/** POST /api/auth/organization/create — the creator becomes the organization `owner`. */
export function createOrganization(
    client: APIRequestContext,
    org: { name: string; slug: string },
): Promise<APIResponse> {
    return client.post(`${AUTH_BASE}/organization/create`, { data: org, failOnStatusCode: false });
}

/** POST /api/auth/organization/set-active — sets `session.activeOrganizationId`. */
export function setActiveOrganization(client: APIRequestContext, organizationId: string): Promise<APIResponse> {
    return client.post(`${AUTH_BASE}/organization/set-active`, {
        data: { organizationId },
        failOnStatusCode: false,
    });
}

/** Sign a brand-new user up and hand back their authenticated client. */
export async function signedUpUser(prefix: string): Promise<{ email: string; client: APIRequestContext }> {
    const email = uniqueEmail(prefix);
    const client = await newClient();
    const res = await signUp(client, { email, password: PASSWORD });
    if (res.status() !== 200) {
        throw new Error(`sign-up for ${email} failed with ${res.status()}: ${await res.text()}`);
    }
    return { email, client };
}

let counter = 0;

/** Unique per call so a rerun against a surviving volume never collides on the email index. */
export function uniqueEmail(prefix = 'user'): string {
    counter += 1;
    return `${prefix}.${Date.now().toString(36)}.${counter}@example.test`;
}

/** Unique note titles keep `GET /notes` (which lists *every* note) unambiguous across specs. */
export function uniqueTitle(prefix = 'note'): string {
    counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
