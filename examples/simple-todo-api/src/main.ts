import path from 'path';

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { requestLogger, HttpExceptionFilter } from '@trailmix-cms/utils';
import { buildOpenApiDocument, writeOpenApiSpec } from '@trailmix-cms/core';
import { pkg } from './utils/environment';
import { AppConfig } from './config';

import { Logger } from '@nestjs/common';

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

    const document = buildOpenApiDocument(app, {
        title: 'Trailmix CMS Example API',
        description: `API (build ${configService.get('BUILD_ID')})`,
        version: pkg.version,
        license: {
            name: 'Apache 2.0',
            url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
        },
    });


    SwaggerModule.setup('api-docs', app, document);
    SwaggerModule.setup('/', app, document);

    if (configService.get('GENERATE_SPEC')) {
        writeOpenApiSpec(document, { outputDir: path.resolve(__dirname, '../docs'), logger });
        await app.close();
        return;
    }

    // await app.register(clerkPlugin, {
    //     secretKey: configService.get('CLERK_SECRET_KEY'),
    //     publishableKey: configService.get('CLERK_PUBLISHABLE_KEY'),
    // });

    // const migrationService = app.get(MigrationService);
    // await migrationService.run();

    await app.init();
    await app.listen({
        port: configService.get('PORT'),
        host: '0.0.0.0',
    });
    logger.log(`App listening on port: ${configService.get('PORT')}`);
}

bootstrap();