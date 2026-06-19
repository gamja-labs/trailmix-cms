import { randomBytes } from 'crypto';
import { ChildProcess, spawn } from 'child_process';
import { createServer } from 'net';
import { resolve } from 'path';

import { MongoClient, Db } from 'mongodb';

const CORE_API_ROOT = resolve(__dirname, '../..');
const MAIN_ENTRY = resolve(CORE_API_ROOT, 'dist/main.js');
const MONGODB_CONNECTION_STRING = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/?replicaSet=rs0';
const MONGODB_DATABASE_NAME = `integration_test_${Date.now()}`;

export interface TestContext {
    baseUrl: string;
    db: Db;
    mongoClient: MongoClient;
    proc: ChildProcess;
}

/** Ask the OS for a free TCP port by binding to :0 and reading it back. */
function freePort(): Promise<number> {
    return new Promise((res, rej) => {
        const srv = createServer();
        srv.once('error', rej);
        srv.listen(0, () => {
            const port = (srv.address() as { port: number }).port;
            srv.close(() => res(port));
        });
    });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Boots the **real** core-api server in a child process and waits for it to be ready.
 *
 * core-api's dependency tree (better-auth + @thallesp/nestjs-better-auth + @trailmix-cms/core)
 * is ESM-only, which jest's in-process module runtime can't load cleanly under Yarn PnP. So
 * rather than import the app into the test, we run the built `dist/main.js` exactly as
 * production does — letting Node + the PnP ESM loader handle the module graph — and drive it
 * over HTTP. This also means the suite exercises the genuine bootstrap and better-auth routes,
 * with nothing stubbed.
 *
 * Requires `yarn build` first (the `test:integration` script does this).
 */
export async function createTestContext(): Promise<TestContext> {
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    const env: NodeJS.ProcessEnv = {
        ...process.env, // carries Yarn's PnP NODE_OPTIONS so the child resolves the ESM graph
        NODE_ENV: 'test',
        PORT: String(port),
        SERVICE_HOST: baseUrl,
        MONGODB_CONNECTION_STRING,
        MONGODB_DATABASE_NAME,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || randomBytes(32).toString('base64'),
        BETTER_AUTH_URL: baseUrl,
        GENERATE_SPEC: 'false',
    };

    const proc = spawn(process.execPath, [MAIN_ENTRY], { env, cwd: CORE_API_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

    // Buffer output so a failed boot reports something actionable instead of a bare timeout.
    let output = '';
    proc.stdout?.on('data', (d) => (output += d.toString()));
    proc.stderr?.on('data', (d) => (output += d.toString()));

    let exited = false;
    proc.once('exit', () => (exited = true));

    // Poll the anonymous /status endpoint until the server answers.
    const deadline = Date.now() + 45_000;
    let ready = false;
    while (Date.now() < deadline) {
        if (exited) throw new Error(`core-api exited before becoming ready.\n--- server output ---\n${output}`);
        try {
            const res = await fetch(`${baseUrl}/status`);
            if (res.ok) {
                ready = true;
                break;
            }
        } catch {
            // not listening yet
        }
        await delay(250);
    }
    if (!ready) {
        proc.kill('SIGKILL');
        throw new Error(`core-api did not become ready within 45s.\n--- server output ---\n${output}`);
    }

    const mongoClient = new MongoClient(MONGODB_CONNECTION_STRING);
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DATABASE_NAME);

    return { baseUrl, db, mongoClient, proc };
}

export async function teardownTestContext(ctx: TestContext | undefined): Promise<void> {
    if (!ctx) return;
    if (ctx.db) await ctx.db.dropDatabase().catch(() => {});
    if (ctx.mongoClient) await ctx.mongoClient.close().catch(() => {});
    if (ctx.proc && !ctx.proc.killed) {
        ctx.proc.kill('SIGTERM');
        // Give it a moment to close the Mongo connection cleanly, then force-kill if needed.
        await delay(500);
        if (ctx.proc.exitCode === null) ctx.proc.kill('SIGKILL');
    }
}
