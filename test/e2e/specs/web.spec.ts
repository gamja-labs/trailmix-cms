import { test, expect, type Page, type BrowserContext } from '@playwright/test';

import { PASSWORD, uniqueEmail, uniqueTitle } from '../fixtures/api';

/**
 * The same features as `api.spec.ts`, but exercised the way a user does: headless Chromium
 * against the built core-web bundle, which talks to core-api over credentialed cross-origin
 * XHR carrying better-auth's session cookie.
 *
 * This is the half the API spec cannot cover — the generated client, the CORS + trusted-origin
 * configuration, the router guard, and the cookie surviving a real browser navigation.
 *
 * One serial journey, one browser context: the session cookie has to carry across steps, which
 * is precisely what is under test.
 */
test.describe.serial('core-web', () => {
    const email = uniqueEmail('web');
    const name = 'Ada Lovelace';
    const noteTitle = uniqueTitle('web-note');

    let context: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();
        page = await context.newPage();
    });

    test.afterAll(async () => {
        await context?.close();
    });

    test('the signed-out login page reaches core-api’s anonymous routes', async () => {
        await page.goto('/login');

        // These two cards are rendered from live `GET /status` and `GET /public/greeting` calls,
        // so seeing them at all proves the bundle's baked-in API origin, CORS and the proxy
        // all line up — before any auth is involved.
        const publicCard = page.locator('.public-card');
        await expect(publicCard).toContainText('ok');
        await expect(publicCard).toContainText('authenticated:');
        await expect(publicCard).toContainText('false');
        await expect(publicCard.locator('.public-error')).toHaveCount(0);
    });

    test('signing up through the form lands on the authenticated dashboard', async () => {
        await page.getByRole('button', { name: 'Sign up' }).click();

        await page.locator('#name').fill(name);
        await page.locator('#email').fill(email);
        await page.locator('#password').fill(PASSWORD);
        await page.getByRole('button', { name: 'Create account' }).click();

        // The router guard only lets us through once `authClient.getSession()` resolves, so
        // arriving here means the cookie was set on the API origin and replayed successfully.
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

        // GET /me — session required.
        await expect(page.locator('pre.session-json')).toContainText(email);

        // GET /public/greeting — now personalized, i.e. the optional-auth route saw the session.
        await expect(page.locator('.greeting-message')).toContainText(name);
        await expect(page.locator('.info-card').filter({ hasText: 'Greeting' })).toContainText('true');
    });

    test('creating, editing and deleting a note round-trips through the revisable collection', async () => {
        await page.getByRole('link', { name: 'Notes', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

        // --- create
        await page.getByRole('button', { name: '+ New Note' }).click();
        await page.locator('#new-note-title').fill(noteTitle);
        await page.locator('#new-note-body').fill('first draft');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        const noteItem = page.locator('.note-item').filter({ hasText: noteTitle });
        await expect(noteItem).toBeVisible();
        await expect(noteItem.locator('.version-badge')).toHaveText('v0');
        await expect(noteItem.locator('.note-body')).toHaveText('first draft');

        // --- edit: the dialog sends the version it read, and the server bumps it to 1.
        await noteItem.getByRole('button', { name: 'Edit' }).click();
        await page.locator('#edit-note-body').fill('second draft');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(noteItem.locator('.version-badge')).toHaveText('v1');
        await expect(noteItem.locator('.note-body')).toHaveText('second draft');

        // --- audit trail: one revision for the create, one for the update.
        await noteItem.getByRole('button', { name: 'History' }).click();
        const history = page.locator('.dialog-content-wide');
        await expect(history.getByRole('heading', { name: /Revision History/ })).toBeVisible();
        await expect(history.locator('.history-entry')).toHaveCount(2);
        await expect(history.locator('.action-badge')).toContainText(['update', 'create']);
        await history.getByRole('button', { name: 'Close' }).click();

        // --- delete: the view confirms first, then version-checks the delete.
        page.once('dialog', (dialog) => dialog.accept());
        await noteItem.getByRole('button', { name: 'Delete' }).click();
        await expect(noteItem).toHaveCount(0);
    });

    test('the admin page shows the server-side role guard rejecting, then admitting, the user', async () => {
        await page.getByRole('link', { name: 'Admin', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Admin & roles' })).toBeVisible();

        // Signed in, but not an admin: the route is reachable, the *endpoint* is not. The guard
        // rejecting here is what makes the success below meaningful.
        const adminCard = page.locator('.info-card').filter({ hasText: 'System admin' });
        await expect(adminCard.locator('.result-error')).toBeVisible();
        await expect(adminCard.locator('.result-json')).toHaveCount(0);

        await page.getByRole('button', { name: 'Promote me to admin' }).click();

        // The promote route rewrites the role through better-auth's internal adapter and the view
        // reloads the cards itself. `getSession` re-reads the role from Mongo on every call, so
        // that reload should already show the payload — but the endpoint's own response warns the
        // session can look stale, so poll the page's Refresh rather than trusting a single pass.
        await expect
            .poll(async () => {
                await page.getByRole('button', { name: 'Refresh' }).click();
                return adminCard.locator('.result-json').count();
            }, { timeout: 20_000 })
            .toBeGreaterThan(0);

        await expect(adminCard.locator('.result-json')).toContainText('"role": "admin"');
        await expect(adminCard.locator('.result-json')).toContainText(email);
        await expect(adminCard.locator('.result-error')).toHaveCount(0);
    });

    test('signing out clears the session and the router guard closes the app', async () => {
        await page.getByRole('button', { name: 'Sign out' }).click();
        await page.waitForURL('**/login');

        // The cookie is gone, so the guard bounces a direct navigation back to the login page.
        await page.goto('/');
        await page.waitForURL('**/login');
        await expect(page.locator('#email')).toBeVisible();
    });
});
