import { str, port, bool, cleanEnv } from 'envalid';

export const configuration = () => {
    const config = cleanEnv(process.env, {
        NODE_ENV: str({
            default: 'development',
            choices: ['development', 'test', 'production'],
        }),
        PORT: port({
            default: 80,
            devDefault: 3000,
            desc: 'The port the app is running on',
        }),
        SERVICE_HOST: str({
            desc: 'The host the app is running on',
            example: 'https://api.example.com',
            default: 'http://localhost:3000',
        }),
        GENERATE_SPEC: bool({
            default: false,
            desc: 'Generates OpenAPI spec file in the docs directory and exits the application.',
        }),
        CLERK_PUBLISHABLE_KEY: str({
            desc: 'Clerk publishable key',
            example: 'pk_test_123456.....',
            ...(process.env.GENERATE_SPEC === 'true' ? { default: '', allowEmpty: true } : {}),
        }),
        CLERK_SECRET_KEY: str({
            desc: 'Clerk secret key',
            example: 'sk_test_123456.....',
            ...(process.env.GENERATE_SPEC === 'true' ? { default: '', allowEmpty: true } : {}),
        }),
        BUILD_ID: str({
            desc: 'Unique identifier generated at build time.',
            example: '1234567890',
            default: new Date().toISOString(),
        }),
    });
    return {
        ...config,
        onModuleInit: false // Fix issue where nestjs checks for onModuleInit hook and fails if it doesn't exist
    };
};

export type AppConfig = ReturnType<typeof configuration>;