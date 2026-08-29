import { defineConfig, devices } from '@playwright/test';

/** Origin the core-web SPA is served from (the edge's :8080 listener). */
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:8080';

/** Origin core-api answers on *as the browser sees it* (the edge's :8081 listener). */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8081';

export default defineConfig({
    testDir: './specs',

    // core-api's notes collection is global (`GET /notes` lists every note, not just the caller's)
    // and the specs promote users to admin, so the suite shares mutable server state. One worker,
    // no parallelism — the runtime is dominated by the image build anyway.
    fullyParallel: false,
    workers: 1,

    forbidOnly: !!process.env.CI,
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },

    reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],

    use: {
        baseURL: WEB_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        ...devices['Desktop Chrome'],
        launchOptions: {
            // The runner container is root, where Chromium's setuid sandbox refuses to start, and
            // Docker's default 64MB /dev/shm is too small for Chromium's shared-memory renderer
            // (it crashes mid-navigation). The compose service also raises shm_size; this flag
            // makes the suite work even when run against a plain `docker run`.
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        },
    },
});
