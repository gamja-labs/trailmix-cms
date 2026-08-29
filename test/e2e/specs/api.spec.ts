import { test, expect, type APIRequestContext } from '@playwright/test';

import {
    PASSWORD,
    createOrganization,
    newClient,
    setActiveOrganization,
    signIn,
    signUp,
    signedUpUser,
    uniqueEmail,
    uniqueTitle,
} from '../fixtures/api';

/**
 * core-api driven directly over HTTP, through the same edge origin the browser uses. Nothing is
 * stubbed: these hit the real better-auth routes, the real guards, and a real MongoDB replica set.
 *
 * The happy path is the spine of each block; the negative assertions sitting next to it are the
 * ones that prove the happy path actually means something (a route that 200s for everyone is not
 * evidence that auth works).
 */
test.describe('core-api', () => {
    const clients: APIRequestContext[] = [];

    /** Track every context so they are disposed together — each one holds a live connection. */
    const track = <T extends APIRequestContext>(client: T): T => {
        clients.push(client);
        return client;
    };

    test.afterAll(async () => {
        await Promise.all(clients.map((c) => c.dispose().catch(() => {})));
    });

    test.describe('public routes', () => {
        test('GET /status answers anonymously', async () => {
            const client = track(await newClient());

            const res = await client.get('/status');
            expect(res.status()).toBe(200);

            const body = await res.json();
            expect(body.status).toBe('ok');
            expect(typeof body.version).toBe('string');
        });

        test('GET /public/greeting is generic anonymously and personalized with a session', async () => {
            const anon = track(await newClient());
            const anonRes = await anon.get('/public/greeting');
            expect(anonRes.status()).toBe(200);
            expect((await anonRes.json()).authenticated).toBe(false);

            const { email, client } = await signedUpUser('greeting');
            track(client);

            const authedRes = await client.get('/public/greeting');
            expect(authedRes.status()).toBe(200);

            const authed = await authedRes.json();
            expect(authed.authenticated).toBe(true);
            expect(authed.message).toContain(email.split('@')[0]);
        });
    });

    test.describe('better-auth email + password', () => {
        test('sign-up issues a session that authenticates the guarded routes', async () => {
            const email = uniqueEmail('signup');
            const client = track(await newClient());

            const res = await signUp(client, { email, password: PASSWORD, name: 'Ada Lovelace' });
            expect(res.status()).toBe(200);
            expect((await res.json()).user.email).toBe(email);

            // The global AuthGuard is satisfied purely by the cookie the sign-up response set.
            const me = await client.get('/me');
            expect(me.status()).toBe(200);

            const body = await me.json();
            expect(body.user.email).toBe(email);
            expect(body.session.id).toBeTruthy();
        });

        test('GET /me without a session is rejected', async () => {
            const client = track(await newClient());

            const res = await client.get('/me');
            expect(res.status()).toBe(401);
        });

        test('sign-in succeeds with the right password and fails with the wrong one', async () => {
            const email = uniqueEmail('signin');
            await signUp(track(await newClient()), { email, password: PASSWORD });

            const good = await signIn(track(await newClient()), { email, password: PASSWORD });
            expect(good.status()).toBe(200);

            const bad = await signIn(track(await newClient()), { email, password: 'not-the-password' });
            expect(bad.status()).toBe(401);
        });

        test('GET /account/whoami reflects the user better-auth attached to the request', async () => {
            const { email, client } = await signedUpUser('whoami');
            track(client);

            const res = await client.get('/account/whoami');
            expect(res.status()).toBe(200);

            const body = await res.json();
            expect(body.email).toBe(email);
            expect(body.userId).toBeTruthy();
            expect(body.sessionId).toBeTruthy();
        });
    });

    test.describe('notes — revisable collection', () => {
        test('creates, reads, updates and deletes a note, recording a revision per mutation', async () => {
            const { client } = await signedUpUser('notes');
            track(client);

            const title = uniqueTitle('e2e');

            // --- create: the collection seeds version 0; callers never set it themselves.
            const created = await client.post('/notes', { data: { title, body: 'first draft' } });
            expect(created.status()).toBe(201);

            const note = await created.json();
            expect(note._id).toBeTruthy();
            expect(note.title).toBe(title);
            expect(note.version).toBe(0);

            // --- read: both the list and the by-id route see it.
            const list = await client.get('/notes');
            expect(list.status()).toBe(200);
            const listed = await list.json();
            expect(listed.count).toBe(listed.items.length);
            expect(listed.items.some((n: { _id: string }) => n._id === note._id)).toBe(true);

            const fetched = await client.get(`/notes/${note._id}`);
            expect(fetched.status()).toBe(200);
            expect((await fetched.json()).title).toBe(title);

            // --- update: sending the version we last read bumps it to 1.
            const updated = await client.put(`/notes/${note._id}`, {
                data: { title, body: 'second draft', version: 0 },
            });
            expect(updated.status()).toBe(200);

            const afterUpdate = await updated.json();
            expect(afterUpdate.version).toBe(1);
            expect(afterUpdate.body).toBe('second draft');

            // --- optimistic concurrency: replaying the stale version is refused, not silently
            //     applied. This is the assertion that proves versioning is actually enforced.
            const stale = await client.put(`/notes/${note._id}`, {
                data: { title, body: 'lost update', version: 0 },
                failOnStatusCode: false,
            });
            expect(stale.status()).toBe(409);

            const unchanged = await client.get(`/notes/${note._id}`);
            expect((await unchanged.json()).body).toBe('second draft');

            // --- audit trail: create + update each recorded a revision.
            const history = await client.get(`/notes/${note._id}/revisions`);
            expect(history.status()).toBe(200);

            const revisions = await history.json();
            expect(revisions.count).toBeGreaterThanOrEqual(2);
            const actions = revisions.items.map((r: { action: string }) => r.action);
            expect(actions).toContain('create');
            expect(actions).toContain('update');

            // --- delete: version-checked too, and the note is gone afterwards.
            const removed = await client.delete(`/notes/${note._id}?version=1`);
            expect(removed.ok()).toBe(true);

            const gone = await client.get(`/notes/${note._id}`, { failOnStatusCode: false });
            expect(gone.status()).toBe(404);
        });

        test('notes are closed to anonymous callers', async () => {
            const anon = track(await newClient());

            expect((await anon.get('/notes', { failOnStatusCode: false })).status()).toBe(401);
            expect(
                (await anon.post('/notes', { data: { title: uniqueTitle('anon') }, failOnStatusCode: false })).status(),
            ).toBe(401);
        });
    });

    test.describe("@Roles(['admin']) — system-level RBAC", () => {
        test('rejects a regular user and admits them once promoted', async () => {
            const { email, client } = await signedUpUser('admin');
            track(client);

            const before = await client.get('/admin/overview', { failOnStatusCode: false });
            expect(before.status()).toBe(403);

            // core-api's test-only route writes the admin-plugin role through better-auth's
            // internal adapter — the plugin's own setRole cannot bootstrap the first admin.
            const promoted = await client.post('/test/promote-admin');
            expect(promoted.status()).toBe(200);
            expect((await promoted.json()).role).toBe('admin');

            // getSession re-reads the role from Mongo, so the existing cookie now passes the guard.
            await expect
                .poll(async () => (await client.get('/admin/overview', { failOnStatusCode: false })).status())
                .toBe(200);

            const overview = await client.get('/admin/overview');
            const body = await overview.json();
            expect(body.you).toBe(email);
            expect(body.role).toBe('admin');

            // ...and demoting closes the door again.
            expect((await client.post('/test/demote-admin')).status()).toBe(200);
            await expect
                .poll(async () => (await client.get('/admin/overview', { failOnStatusCode: false })).status())
                .toBe(403);
        });
    });

    test.describe("@OrgRoles(['owner', 'admin']) — organization-scoped RBAC", () => {
        test('rejects a user with no active organization', async () => {
            const { client } = await signedUpUser('noorg');
            track(client);

            const res = await client.get('/organizations/active/settings', { failOnStatusCode: false });
            expect(res.status()).toBe(403);
        });

        test('admits the owner of the active organization', async () => {
            const { client } = await signedUpUser('owner');
            track(client);

            const slug = `org-${Date.now().toString(36)}`;
            const created = await createOrganization(client, { name: 'Acme', slug });
            expect(created.status()).toBe(200);

            const organizationId = (await created.json()).id as string;
            expect(organizationId).toBeTruthy();

            // better-auth activates a freshly created org on the creator's session; calling
            // set-active explicitly is idempotent and confirms the endpoint round-trips.
            expect((await setActiveOrganization(client, organizationId)).status()).toBe(200);

            const res = await client.get('/organizations/active/settings');
            expect(res.status()).toBe(200);
            expect((await res.json()).activeOrganizationId).toBe(organizationId);
        });
    });
});
