import * as fs from 'node:fs';
import * as path from 'node:path';

import { type INestApplication, Logger, type LoggerService } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Options controlling how the OpenAPI document is built.
 *
 * Anything not covered by these options can be set through the {@link BuildOpenApiDocumentOptions.configure}
 * escape hatch, which receives the underlying {@link DocumentBuilder} before the document is generated.
 */
export interface BuildOpenApiDocumentOptions {
    /** The API title shown in the generated spec. */
    title: string;
    /** A human readable description of the API. */
    description?: string;
    /** The API version (typically your package version). */
    version?: string;
    /** License metadata for the API. */
    license?: { name: string; url?: string };
    /** Add a bearer (HTTP) auth scheme. Defaults to `true`. */
    bearerAuth?: boolean;
    /**
     * Add an API key security scheme. Pass an object to enable it, or omit to skip.
     * `securityName` is the name the scheme is registered under (defaults to `'api-key'`).
     */
    apiKey?: { name: string; in?: 'header' | 'query'; securityName?: string };
    /** Escape hatch to further customize the builder before the document is created. */
    configure?: (builder: DocumentBuilder) => void;
    /** OpenAPI version to clean the document down to. Defaults to `'3.0'`. */
    openApiVersion?: '3.0' | '3.1';
}

/**
 * Builds a cleaned-up OpenAPI document for a Nest application.
 *
 * Wraps the repeated `DocumentBuilder` + `SwaggerModule.createDocument` + `cleanupOpenApiDoc`
 * boilerplate so applications only need to declare the parts that differ.
 *
 * @example
 * ```ts
 * const document = buildOpenApiDocument(app, {
 *     title: 'Trailmix CMS Example API',
 *     description: `API (build ${configService.get('BUILD_ID')})`,
 *     version: pkg.version,
 *     license: { name: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0.html' },
 *     apiKey: apiKeyEnabled ? { name: 'x-api-key' } : undefined,
 * });
 * ```
 */
export function buildOpenApiDocument(
    app: INestApplication,
    options: BuildOpenApiDocumentOptions,
): OpenAPIObject {
    const builder = new DocumentBuilder().setTitle(options.title);

    if (options.description !== undefined) builder.setDescription(options.description);
    if (options.version !== undefined) builder.setVersion(options.version);
    if (options.license) builder.setLicense(options.license.name, options.license.url ?? '');
    if (options.bearerAuth ?? true) builder.addBearerAuth();
    if (options.apiKey) {
        builder.addApiKey(
            { type: 'apiKey', in: options.apiKey.in ?? 'header', name: options.apiKey.name },
            options.apiKey.securityName ?? 'api-key',
        );
    }

    options.configure?.(builder);

    return cleanupOpenApiDoc(SwaggerModule.createDocument(app, builder.build()), {
        version: options.openApiVersion ?? '3.0',
    });
}

/** Options controlling where and how the OpenAPI spec file is written. */
export interface WriteOpenApiSpecOptions {
    /** Directory the spec file is written to. Created recursively if it doesn't exist. */
    outputDir: string;
    /** The file name to write. Defaults to `'api-json.json'`. */
    fileName?: string;
    /** Logger used for progress messages. Defaults to a `Logger` scoped to `'OpenAPI'`. */
    logger?: LoggerService;
}

/**
 * Writes an OpenAPI document to disk as JSON, creating the output directory if needed.
 *
 * This is the helper for the common "generate spec then exit" flow:
 *
 * ```ts
 * if (configService.get('GENERATE_SPEC')) {
 *     writeOpenApiSpec(document, { outputDir: path.resolve(__dirname, '../docs') });
 *     await app.close();
 *     return;
 * }
 * ```
 *
 * @returns The absolute path of the file that was written.
 */
export function writeOpenApiSpec(
    document: OpenAPIObject,
    options: WriteOpenApiSpecOptions,
): string {
    const logger = options.logger ?? new Logger('OpenAPI');
    const outputDir = path.resolve(options.outputDir);
    const filePath = path.join(outputDir, options.fileName ?? 'api-json.json');

    logger.log(`Generating OpenAPI spec to ${filePath}...`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(document));
    logger.log('Generating OpenAPI spec complete.');

    return filePath;
}
