import { DynamicModule, Module, ModuleMetadata, Provider, Type } from '@nestjs/common';
import { createDatabaseProviders, connectionFactory, collectionFactory, Collections, DatabaseService, DB_CONNECTION } from '@trailmix-cms/db';

import { CoreCollectionName } from './constants/index.js';
import { SecurityAuditCollection } from './collections/index.js';
import { SecurityAuditService } from './services/index.js';
import { SecurityAuditsController } from './controllers/index.js';

/** Carrier module: opens the single Mongo connection once and exports it for sharing. */
@Module({})
class TrailmixConnectionModule {}

/**
 * The spreadable pieces {@link setupTrailmixCore} produces. Spread each into your own
 * `@Module({})`, and pass {@link TrailmixCoreSetup.connectionModule} to your auth integration
 * (e.g. `@trailmix-cms/core`'s `setupTrailmixAuth`) so it builds on the same connection:
 *
 * ```ts
 * const core = setupTrailmixCore();
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration] }),  // MONGODB_* / GENERATE_SPEC
 *     ...core.imports,
 *   ],
 *   controllers: [...core.controllers],
 *   providers: [...core.providers],
 * })
 * export class AppModule {}
 * ```
 */
export interface TrailmixCoreSetup {
    /** Modules to register — an internal connection carrier that opens and exports the Mongo connection. */
    imports: NonNullable<ModuleMetadata['imports']>;
    /** Providers: the `@trailmix-cms/db` providers and the `security-audits` collection/service. */
    providers: Provider[];
    /** Controllers: the admin-guarded `security-audits` controller, unless disabled. */
    controllers: Type<unknown>[];
    /**
     * The connection carrier module — it owns and exports `DB_CONNECTION`. Pass this to your auth
     * integration's setup (e.g. `setupTrailmixAuth({ connectionModule })`) so better-auth builds its
     * adapter on the **same** connection `@trailmix-cms/db` uses. One connection, shared.
     */
    connectionModule: DynamicModule;
    /** The `@trailmix-cms/db` connection token, re-exported for convenience. */
    DB_CONNECTION: typeof DB_CONNECTION;
}

/**
 * Options for {@link setupTrailmixCore}.
 *
 * The setup opens the single Mongo connection via `@trailmix-cms/db`'s `connectionFactory`
 * (from `ConfigService` — `MONGODB_CONNECTION_STRING` / `MONGODB_DATABASE_NAME` / `GENERATE_SPEC`)
 * and exports it for sharing. Wire auth onto the same connection with your auth integration package.
 *
 * `ConfigService` must be resolvable in the module tree — make `ConfigModule` global (loading
 * `@trailmix-cms/db`'s `configuration`), or pass it via {@link imports}.
 */
export interface TrailmixCoreOptions extends Pick<ModuleMetadata, 'imports'> {
    /** Register the admin-guarded `security-audits` controller. Defaults to `true`. */
    securityAuditsController?: boolean;
}

/** The non-connection providers the Trailmix core setup contributes. */
function coreProviders(): Provider[] {
    return [
        collectionFactory(CoreCollectionName.SecurityAudit),
        SecurityAuditCollection,
        SecurityAuditService,
    ];
}

function coreControllers(securityAuditsController?: boolean): Type<unknown>[] {
    return (securityAuditsController ?? true) ? [SecurityAuditsController] : [];
}

/**
 * Sets up Trailmix's database + security-audit core and returns spreadable
 * `{ imports, providers, controllers, connectionModule }` to drop into your own `@Module({})`.
 *
 * Opens the single Mongo connection via `@trailmix-cms/db`'s `connectionFactory`
 * (`ConfigService`-driven — load that package's `configuration` via `ConfigModule`), stubbing it
 * for `generateSpec` runs, wires up the `@trailmix-cms/db` providers, and registers the
 * {@link SecurityAuditCollection} / {@link SecurityAuditService}.
 *
 * Core is **auth-agnostic** — pass {@link TrailmixCoreSetup.connectionModule} to your auth
 * integration package (e.g. `@trailmix-cms/core`) to add authentication on the same connection.
 *
 * @example
 * ```ts
 * const core = setupTrailmixCore();
 * const auth = setupTrailmixAuth({ connectionModule: core.connectionModule, createAuth });
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
export function setupTrailmixCore(options: TrailmixCoreOptions = {}): TrailmixCoreSetup {
    // One carrier module opens the connection once via @trailmix-cms/db's connectionFactory
    // (DB_CONNECTION) and exports it. Both the db providers below and any auth integration that
    // imports this module reach the same connection, so Mongo is connected a single time and shared.
    const connectionModule: DynamicModule = {
        module: TrailmixConnectionModule,
        imports: options.imports ?? [],
        providers: [connectionFactory],
        exports: [DB_CONNECTION],
    };

    return {
        imports: [connectionModule],
        providers: [
            // DB_CONNECTION is owned and exported by connectionModule (imported above); these
            // providers consume it rather than opening a second connection.
            ...createDatabaseProviders({ externalConnection: true }),
            ...coreProviders(),
        ],
        controllers: coreControllers(options.securityAuditsController),
        connectionModule,
        DB_CONNECTION,
    };
}

/**
 * Providers consumers re-export when a feature module of theirs needs to inject the audit /
 * revision collections or {@link DatabaseService} that the core setup contributes. Spreading
 * `setupTrailmixCore(...)`'s providers already makes these injectable within the same module;
 * add these to that module's `exports` to share them with imported feature modules.
 */
export const trailmixCoreExports = [
    DatabaseService,
    Collections.AuditCollection,
    Collections.RevisionCollection,
    SecurityAuditCollection,
    SecurityAuditService,
];
