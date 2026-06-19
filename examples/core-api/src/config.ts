import { str, port, bool, cleanEnv } from 'envalid';

// App-level config only. The Mongo connection vars live in `@trailmix-cms/db`'s `configuration`
// and the better-auth vars in `@trailmix-cms/core`'s `configuration` — both loaded into
// `ConfigModule` in `app.module.ts`, so each package validates the env it owns. (The email
// provider reads RESEND_API_KEY / EMAIL_FROM directly in `app.module.ts`.)
export const configuration = () => {
    return cleanEnv(process.env, {
        NODE_ENV: str({
            default: 'development',
            choices: ['development', 'test', 'production'],
        }),
        PORT: port({
            default: 80,
            devDefault: 3000,
            desc: 'The port the API listens on',
        }),
        SERVICE_HOST: str({
            desc: 'Public base URL of this API',
            example: 'https://api.example.com',
            default: 'http://localhost:3000',
        }),
        WEB_ORIGIN: str({
            desc: 'Origin of the core-web frontend, allowed for credentialed CORS requests and '
                + 'registered as a better-auth trusted origin.',
            example: 'https://app.example.com',
            default: 'http://localhost:5175',
        }),
        GENERATE_SPEC: bool({
            default: false,
            desc: 'Write the OpenAPI spec to ./docs and exit instead of starting the server.',
        }),
    });
};

export type AppConfig = ReturnType<typeof configuration>;
