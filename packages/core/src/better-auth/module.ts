import { DynamicModule, Module, ModuleMetadata, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { DB_CONNECTION, type DatabaseConnection } from '@trailmix-cms/db';

import type { TrailmixAuthDatabase } from './auth.js';
import { TrailmixAdminGuard } from './admin.guard.js';

type AuthModuleForRootOptions = Parameters<typeof AuthModule.forRoot>[0];

/** The better-auth instance type Trailmix's setup helper registers with the `AuthModule`. */
type TrailmixAuth = AuthModuleForRootOptions['auth'];

/** Token holding the better-auth instance built by {@link setupTrailmixAuth}. */
const TRAILMIX_AUTH = Symbol('TRAILMIX_AUTH');

/** Carrier module: builds the better-auth instance from the shared connection and exports it. */
@Module({})
class TrailmixAuthOptionsModule {}

/** Registers {@link TrailmixAdminGuard} globally to enforce core's `@RequireAdmin()` marker. */
@Module({
    providers: [{ provide: APP_GUARD, useClass: TrailmixAdminGuard }],
})
class TrailmixAuthGuardsModule {}

/**
 * Options for {@link setupTrailmixAuth}.
 *
 * The shared Mongo connection is opened by `@trailmix-cms/core`'s `setupTrailmixCore`, which
 * returns a `connectionModule`. Pass that module here so better-auth builds its adapter on the
 * **same** connection `@trailmix-cms/db` uses — one connection, shared.
 */
export interface SetupTrailmixAuthOptions {
    /**
     * The `connectionModule` returned by `setupTrailmixCore`. It owns and exports `DB_CONNECTION`;
     * importing it here lets the better-auth instance reach the shared connection.
     */
    connectionModule: DynamicModule;
    /**
     * Builds the better-auth instance from the MongoDB adapter Trailmix creates (on the shared
     * connection) and passes in. Drop the `database` straight into your `betterAuth({ database, ... })`
     * call with `trailmixPlugins`, or use the `createTrailmixAuth(database, config)` shorthand.
     */
    createAuth: (database: TrailmixAuthDatabase) => TrailmixAuth | Promise<TrailmixAuth>;
    /** Additional options forwarded to `@thallesp/nestjs-better-auth`'s `AuthModule`. */
    authModule?: Omit<AuthModuleForRootOptions, 'auth'>;
}

/** The spreadable pieces {@link setupTrailmixAuth} produces — spread into your app `@Module`'s `imports`. */
export interface TrailmixAuthSetup {
    /** Modules to register — the better-auth `AuthModule` plus an internal auth carrier. */
    imports: NonNullable<ModuleMetadata['imports']>;
}

/**
 * Wires `@thallesp/nestjs-better-auth`'s `AuthModule` (which mounts the better-auth route handler
 * and a global `AuthGuard`) onto the shared Mongo connection opened by `setupTrailmixCore`.
 *
 * Build the better-auth instance from the MongoDB adapter passed to {@link SetupTrailmixAuthOptions.createAuth}.
 *
 * @example
 * ```ts
 * const core = setupTrailmixCore({ securityAuditsController: true });
 * const auth = setupTrailmixAuth({
 *   connectionModule: core.connectionModule,
 *   createAuth: (database) => createTrailmixAuth(database, {
 *     baseURL: config.BETTER_AUTH_URL,
 *     secret: config.BETTER_AUTH_SECRET,
 *     emailSender,
 *     admin: true,
 *   }),
 * });
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, authConfiguration] }),
 *     ...core.imports,
 *     ...auth.imports,
 *   ],
 *   controllers: [...core.controllers],
 *   providers: [...core.providers],
 * })
 * export class AppModule {}
 * ```
 */
export function setupTrailmixAuth(options: SetupTrailmixAuthOptions): TrailmixAuthSetup {
    // TRAILMIX_AUTH: the better-auth instance, built by the caller's `createAuth`. We build the
    // MongoDB adapter from the shared connection (imported via connectionModule) and hand it in,
    // so the caller never sees the raw connection or wires up `inject`.
    const authProvider: Provider = {
        provide: TRAILMIX_AUTH,
        useFactory: (connection: DatabaseConnection) =>
            options.createAuth(mongodbAdapter(connection.db, { client: connection.client })),
        inject: [DB_CONNECTION],
    };

    const authOptionsModule: DynamicModule = {
        module: TrailmixAuthOptionsModule,
        // Importing core's connectionModule (which exports DB_CONNECTION) is what keeps the
        // connection single: connectionFactory runs once in that module and both the db providers
        // and this auth provider consume the same DatabaseConnection.
        imports: [options.connectionModule],
        providers: [authProvider],
        exports: [TRAILMIX_AUTH],
    };

    return {
        imports: [
            authOptionsModule,
            AuthModule.forRootAsync({
                imports: [authOptionsModule],
                useFactory: (auth: TrailmixAuth) => ({ ...options.authModule, auth }),
                inject: [TRAILMIX_AUTH],
            }),
            // Registered after AuthModule so its global AuthGuard has populated request.user before
            // TrailmixAdminGuard reads the role for core's @RequireAdmin() routes.
            TrailmixAuthGuardsModule,
        ],
    };
}
