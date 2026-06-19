import { str, cleanEnv } from 'envalid';

/**
 * Validates the Clerk environment variable this provider owns.
 *
 * Load it into `ConfigModule` alongside `@trailmix-cms/db`'s `configuration`. During
 * `GENERATE_SPEC=true` runs the secret may be empty (no real auth happens).
 */
export const configuration = () => {
    const config = cleanEnv(process.env, {
        CLERK_SECRET_KEY: str({
            desc: 'Clerk secret key',
            example: 'sk_test_123456.....',
            ...(process.env.GENERATE_SPEC === 'true' ? { default: '', allowEmpty: true } : {}),
        }),
    });
    return {
        ...config,
        onModuleInit: false, // Fix issue where nestjs checks for onModuleInit hook and fails if it doesn't exist
    };
};

export type AppConfig = ReturnType<typeof configuration>;
