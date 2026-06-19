import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { setupTrailmixCore } from '@trailmix-cms/core';
import { setupTrailmixAuth, createTrailmixAuth, configuration as authConfiguration } from '@trailmix-cms/core/better-auth';
import { EmailModule, LogEmailSender, ResendEmailSender, type EmailSender } from '@trailmix-cms/core/email';
import { collectionFactory, configuration as databaseConfiguration } from '@trailmix-cms/db';

import { controllers } from './controllers';
import { collections } from './collections';
import { hooks } from './hooks';
import { CollectionName } from './constants';

const authConfig = authConfiguration();

// The mailer is fully swappable: use Resend when an API key is configured, otherwise fall back to
// a LogEmailSender so the email flows stay wired (and visible) in development. Replace either with
// your own `EmailSender` implementation to use a different provider.
const emailSender: EmailSender = process.env.RESEND_API_KEY
    ? new ResendEmailSender({
          apiKey: process.env.RESEND_API_KEY,
          from: process.env.EMAIL_FROM ?? 'Trailmix <onboarding@resend.dev>',
      })
    : new LogEmailSender();

// Core is auth-agnostic: it opens the single shared Mongo connection (via @trailmix-cms/db's
// connectionFactory, reading MONGODB_* / GENERATE_SPEC from ConfigService) and registers the
// security-audits feature. It hands back `connectionModule` for the auth integration to build on.
const core = setupTrailmixCore({ securityAuditsController: true });

// Auth wires better-auth onto the SAME connection (core.connectionModule). Passing `emailSender`
// auto-wires the built-in verification / reset / organization-invitation email templates.
const auth = setupTrailmixAuth({
    connectionModule: core.connectionModule,
    createAuth: (database) =>
        createTrailmixAuth(database, {
            baseURL: authConfig.BETTER_AUTH_URL,
            secret: authConfig.BETTER_AUTH_SECRET,
            // Allow the core-web frontend's origin so better-auth accepts its cross-origin
            // sign-in / session requests (the CORS layer in main.ts allows the same origin).
            trustedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:5175'],
            emailSender,
            organization: true,
            admin: true,
            openAPI: true,
            // Empty objects are the minimum required for @thallesp/nestjs-better-auth to attach our
            // @Hook (request lifecycle) and @DatabaseHook (model lifecycle) providers.
            hooks: {},
            databaseHooks: {},
        }),
    // On Fastify the AuthModule's urlencoded parser defaults to `extended: true`, which pulls in
    // the optional `qs` peer dependency at parse time. We don't depend on `qs`, so use the simple
    // parser instead (this API speaks JSON anyway).
    authModule: { bodyParser: { urlencoded: { extended: false } } },
});

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, authConfiguration] }),
        ...core.imports,
        ...auth.imports,
        // Optional: exposes the same `emailSender` to our own providers/hooks via DI (EmailService).
        EmailModule.forRoot({ sender: emailSender }),
    ],
    controllers: [
        ...controllers,
        ...core.controllers,
    ],
    providers: [
        // Zod request validation + response serialization for the DTO-typed routes.
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        // The @trailmix-cms/db providers + security-audits collection/service. Spread here so
        // our own collections below can inject DatabaseService / RevisionCollection directly.
        ...core.providers,
        // The revisable Note collection + its backing Mongo collection token.
        ...collections,
        ...Object.values(CollectionName).map((name) => collectionFactory(name)),
        // better-auth request/database hooks, discovered by the AuthModule.
        ...hooks,
    ],
})
export class AppModule { }
