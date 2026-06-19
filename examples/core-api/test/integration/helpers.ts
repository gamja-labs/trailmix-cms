const AUTH_BASE = '/api/auth';

/**
 * A cookie-aware HTTP client bound to one user. better-auth is cookie-based (no bearer plugin
 * here), so each `Session` keeps its own cookie jar: the `Set-Cookie` from sign-up/sign-in is
 * captured and replayed on subsequent requests, exactly as a browser would.
 */
export class Session {
    private readonly jar = new Map<string, string>();

    constructor(private readonly baseUrl: string) {}

    private cookieHeader(): string {
        return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    private store(res: Response): void {
        for (const sc of res.headers.getSetCookie()) {
            const pair = sc.split(';')[0];
            const eq = pair.indexOf('=');
            if (eq <= 0) continue;
            this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
    }

    /** True once a better-auth session cookie has been issued to this client. */
    get hasSessionCookie(): boolean {
        return [...this.jar.keys()].some((name) => name.includes('session_token'));
    }

    async request(method: string, path: string, opts: { json?: unknown } = {}): Promise<Response> {
        const headers: Record<string, string> = {};
        const cookie = this.cookieHeader();
        if (cookie) headers.cookie = cookie;
        let body: string | undefined;
        if (opts.json !== undefined) {
            headers['content-type'] = 'application/json';
            body = JSON.stringify(opts.json);
        }
        const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body });
        this.store(res);
        return res;
    }
}

export interface Credentials {
    email: string;
    password: string;
    name?: string;
}

/** POST /api/auth/sign-up/email — by default better-auth auto-signs-in, issuing a session cookie. */
export function signUp(session: Session, creds: Credentials): Promise<Response> {
    return session.request('POST', `${AUTH_BASE}/sign-up/email`, {
        json: { name: creds.name ?? creds.email.split('@')[0], email: creds.email, password: creds.password },
    });
}

/** POST /api/auth/sign-in/email. */
export function signIn(session: Session, creds: Credentials): Promise<Response> {
    return session.request('POST', `${AUTH_BASE}/sign-in/email`, {
        json: { email: creds.email, password: creds.password },
    });
}

/** POST /api/auth/organization/create — the creator becomes the org `owner`. */
export function createOrganization(session: Session, org: { name: string; slug: string }): Promise<Response> {
    return session.request('POST', `${AUTH_BASE}/organization/create`, { json: org });
}

/** POST /api/auth/organization/set-active — sets `session.activeOrganizationId`. */
export function setActiveOrganization(session: Session, organizationId: string): Promise<Response> {
    return session.request('POST', `${AUTH_BASE}/organization/set-active`, { json: { organizationId } });
}

/** Generate a unique email per call so reruns against a fresh DB never collide. */
let counter = 0;
export function uniqueEmail(prefix = 'user'): string {
    counter += 1;
    return `${prefix}.${Date.now().toString(36)}.${counter}@example.test`;
}
