import * as fs from 'fs';
import path from 'path';

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { clerkPlugin } from '@clerk/fastify'

import { AppModule } from './app.module';
import { requestLogger, HttpExceptionFilter } from '@trailmix-cms/utils';
import { pkg } from './utils/environment';
import { AppConfig } from './config';

import { cleanupOpenApiDoc } from 'nestjs-zod';
import { Logger } from '@nestjs/common';
import { Utils } from '@trailmix-cms/db';
import { CMSCollectionName } from '@trailmix-cms/cms';
import { OpenApiStudioModule } from '@openapi-studio/nestjs';

async function bootstrap() {
    const logger = new Logger()
    logger.log(`Starting app version: ${pkg.version}`)
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({
            trustProxy: true
        }),
        {
            logger,
        }
    );

    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new HttpExceptionFilter(httpAdapter));

    app.use(requestLogger());

    app.enableCors({
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
    });

    // app.useGlobalPipes(new BodyInspectPipe());

    const configService = app.get(ConfigService<AppConfig>);

    // Check if ApiKey feature is enabled by checking if the collection is registered
    // We need to initialize the app first to check for providers
    await app.init();
    let apiKeyEnabled = false;
    try {
        const apiKeyCollectionToken = Utils.buildCollectionToken(CMSCollectionName.ApiKey);
        app.get(apiKeyCollectionToken, { strict: false });
        apiKeyEnabled = true;
    } catch {
        // ApiKey collection not registered, feature is disabled
        apiKeyEnabled = false;
    }

    const documentBuilder = new DocumentBuilder()
        .setTitle('Trailmix CMS Example API')
        .setDescription(`API (build ${configService.get('BUILD_ID')})`)
        .setLicense(
            'Apache 2.0',
            'https://www.apache.org/licenses/LICENSE-2.0.html',
        )
        .setVersion(pkg.version)
        .addBearerAuth();
    
    if (apiKeyEnabled) {
        documentBuilder.addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key');
    }

    const document = cleanupOpenApiDoc(
        SwaggerModule.createDocument(app, documentBuilder.build()),
        { version: "3.0" }
    );


    // SwaggerModule.setup('api-docs', app, document);
    // SwaggerModule.setup('/', app, document, {
    //     jsonDocumentUrl: '/openapi.json',
    // });

    OpenApiStudioModule.setup('/',app, document, {
        serviceHost: configService.get('SERVICE_HOST'),
        clerkPublishableKey: configService.get('CLERK_PUBLISHABLE_KEY'),
    });

    if (configService.get('GENERATE_SPEC')) {
        logger.log('Generating OpenAPI Spec...');
        const output = path.resolve(__filename, '../../docs/');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.resolve(output, 'api-json.json'), JSON.stringify(document));
        logger.log('Generating OpenAPI Spec complete.');
        app.close();
        return;
    }

    await app.register(clerkPlugin, {
        secretKey: configService.get<string>('CLERK_SECRET_KEY'),
        publishableKey: configService.get<string>('CLERK_PUBLISHABLE_KEY'),
    });

    // const migrationService = app.get(MigrationService);
    // await migrationService.run();
    await app.listen({
        port: configService.get('PORT'),
        host: '0.0.0.0',
    });
    logger.log(`App listening on port: ${configService.get('PORT')}`);
}

bootstrap();