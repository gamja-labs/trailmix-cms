import { str, cleanEnv } from 'envalid';

/**
 * Validates the better-auth environment variables this package owns.
 *
 * Load it into `ConfigModule` alongside `@trailmix-cms/db`'s `configuration` (which owns the
 * `MONGODB_*` / `GENERATE_SPEC` vars), so each package validates only the env it owns.
 *
 * During `GENERATE_SPEC` runs the secret is allowed to be empty (no real auth happens), so the
 * spec can be generated without provisioning a production secret.
 */
export const configuration = () => {
    const config = cleanEnv(process.env, {
        BETTER_AUTH_SECRET: str({
            desc: 'Secret better-auth uses to sign cookies and tokens',
            example: 'generate-with: openssl rand -base64 32',
            ...(process.env.GENERATE_SPEC === 'true' ? { default: '', allowEmpty: true } : {}),
        }),
        BETTER_AUTH_URL: str({
            desc: 'Base URL better-auth is served from (used for cookies / callback URLs)',
            default: 'http://localhost:3000',
        }),
    });
    return {
        ...config,
        onModuleInit: false, // Fix issue where nestjs checks for onModuleInit hook and fails if it doesn't exist
    };
};

export type AppConfig = ReturnType<typeof configuration>;
