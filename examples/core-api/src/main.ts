import 'dotenv/config';
import path from 'path';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { writeOpenApiSpec } from '@trailmix-cms/core';
import { TrailmixOpenApi } from '@trailmix-cms/core/better-auth';

import { AppModule } from './app.module';
import { configuration } from './config';
import { pkg } from './utils/environment';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const config = configuration();
    logger.log(`Starting core-api v${pkg.version} (${config.NODE_ENV})`);

    // The Mongo connection + better-auth instance are built inside the providers that
    // setupTrailmixCore contributes, so they come up here as part of DI — not before bootstrap.
    // Fastify adapter: better-auth needs the raw request body, so on Fastify the AuthModule
    // strips Fastify's default content-type parsers and re-registers them for non-auth routes
    // itself (Nest's Express-only `bodyParser: false` option doesn't apply here).
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

    // CORS is configured by the better-auth AuthModule from `trustedOrigins` (set to WEB_ORIGIN in
    // app.module.ts): it registers @fastify/cors app-wide with `credentials: true` plus a
    // middleware-level fallback that covers the better-auth routes — which app-level CORS alone
    // doesn't fully cover on Fastify. Calling `app.enableCors()` here would register @fastify/cors a
    // second time and fail at listen() with `FST_ERR_DEC_ALREADY_PRESENT: corsPreflightEnabled`.

    // Static helper (à la SwaggerModule): builds the document and folds in the auth routes,
    // resolving the better-auth instance from the app itself — no need to grab auth ourselves.
    const document = await TrailmixOpenApi.buildDocument(app, {
        title: 'Trailmix Core Example API',
        description: 'A minimal NestJS API on @trailmix-cms/core (better-auth + security audits + transactional email).',
        version: pkg.version,
        license: {
            name: 'Apache 2.0',
            url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
        },
    });

    if (config.GENERATE_SPEC) {
        writeOpenApiSpec(document, { outputDir: path.resolve(__dirname, '../docs'), logger });
        await app.close();
        return;
    }

    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/json' });

    await app.listen(config.PORT, '0.0.0.0');
    logger.log(`core-api listening on ${config.SERVICE_HOST} (port ${config.PORT})`);
    logger.log(`API docs: ${config.SERVICE_HOST}/docs`);
}

bootstrap();
