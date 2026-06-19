import { type INestApplication } from '@nestjs/common';
import { type OpenAPIObject } from '@nestjs/swagger';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { buildOpenApiDocument, type BuildOpenApiDocumentOptions } from '../openapi.js';

type GeneratedOpenAPISchema = {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, unknown> };
};

/** Minimal structural type for a better-auth instance with the OpenAPI plugin enabled. */
export type AuthWithOpenAPI = {
    api: { generateOpenAPISchema: () => Promise<GeneratedOpenAPISchema> };
};

export interface MergeBetterAuthOpenAPIOptions {
    /**
     * Base path the better-auth handler is mounted at. better-auth emits paths relative to
     * its own root (e.g. `/sign-in/email`), so they are prefixed with this. Defaults to `/api/auth`.
     */
    basePath?: string;
    /** Swagger tag applied to auth operations that don't already declare one. Defaults to `auth`. */
    tag?: string;
}

/**
 * Merges the better-auth OpenAPI schema (from the better-auth OpenAPI plugin) into an
 * existing `@nestjs/swagger` document, so auth endpoints show up in your main API docs.
 *
 * Requires the better-auth OpenAPI plugin to be enabled (e.g. `openAPI: true` via
 * {@link import('./auth.js').createTrailmixAuthConfig}). The document is mutated in place and returned.
 *
 * @example
 * ```ts
 * let document = SwaggerModule.createDocument(app, config);
 * document = await mergeBetterAuthOpenAPISchema(document, auth);
 * SwaggerModule.setup('docs', app, document);
 * ```
 */
export async function mergeBetterAuthOpenAPISchema(
    document: OpenAPIObject,
    auth: AuthWithOpenAPI,
    options: MergeBetterAuthOpenAPIOptions = {},
): Promise<OpenAPIObject> {
    const basePath = options.basePath ?? '/api/auth';
    const tag = options.tag ?? 'auth';

    const schema = await auth.api.generateOpenAPISchema();

    document.paths ??= {};
    for (const [path, pathItem] of Object.entries(schema.paths ?? {})) {
        for (const operation of Object.values(pathItem)) {
            if (operation && typeof operation === 'object' && 'responses' in operation) {
                const op = operation as { tags?: string[] };
                if (!op.tags?.length) {
                    op.tags = [tag];
                }
            }
        }
        document.paths[`${basePath}${path}`] = pathItem as OpenAPIObject['paths'][string];
    }

    if (schema.components?.schemas) {
        document.components ??= {};
        document.components.schemas = {
            ...document.components.schemas,
            ...schema.components.schemas,
        } as NonNullable<OpenAPIObject['components']>['schemas'];
    }

    return document;
}

/**
 * Static helper for the common Trailmix docs flow, modeled on `SwaggerModule`'s static API.
 *
 * Resolves the better-auth instance from the application container itself, so callers don't
 * have to pull `AuthService` out and pass it around:
 *
 * @example
 * ```ts
 * const document = await TrailmixOpenApi.buildDocument(app, { title: 'My API', version });
 * SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/json' });
 * ```
 *
 * Requires the Trailmix auth setup (which registers `AuthModule`, providing `AuthService`) and
 * the better-auth OpenAPI plugin (e.g. `openAPI: true` via `createTrailmixAuthConfig`).
 */
export class TrailmixOpenApi {
    /**
     * Builds a cleaned OpenAPI document for `app` and merges better-auth's schema into it —
     * `buildOpenApiDocument` (from `@trailmix-cms/core`) + {@link mergeBetterAuthOpenAPISchema}
     * in one call, with the auth instance resolved from `app`.
     */
    static buildDocument(
        app: INestApplication,
        options: BuildOpenApiDocumentOptions,
        mergeOptions?: MergeBetterAuthOpenAPIOptions,
    ): Promise<OpenAPIObject> {
        const document = buildOpenApiDocument(app, options);
        // `AuthService.api` is typed generically, so `generateOpenAPISchema` (added by the
        // openAPI plugin) isn't visible statically; it exists at runtime when openAPI is on.
        const auth = app.get(AuthService, { strict: false }) as unknown as AuthWithOpenAPI;
        return mergeBetterAuthOpenAPISchema(document, auth, mergeOptions);
    }
}
