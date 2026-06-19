import { ModuleMetadata, Provider, Type } from '@nestjs/common';
import { collectionFactory } from '@trailmix-cms/db';

import { ClerkCollectionName } from './constants.js';
import { type FeatureConfig } from './types/index.js';
import { AuthGuard } from './auth.guard.js';
import {
    FeatureService,
    AccountService,
    AuthService,
    GlobalRoleService,
    AuthorizationService,
    OrganizationService,
    OrganizationRoleService,
    ApiKeyService,
} from './services/index.js';
import { GlobalRoleManager, OrganizationManager, OrganizationRoleManager } from './managers/index.js';
import { AccountCollection, RoleCollection, OrganizationCollection, ApiKeyCollection } from './collections/index.js';
import {
    GlobalRolesController,
    OrganizationsController,
    OrganizationRolesController,
    ApiKeysController,
    AccountController,
    AuditController,
    AuditsController,
    SecurityAuditsController,
} from './controllers/index.js';

/**
 * Opt-in REST controllers. Each is mounted only when set to `true`. They reuse providers already
 * contributed by `setupTrailmixCore()` / `setupTrailmixClerkAuth()` (db audit collection,
 * security-audit collection, `GlobalRoleService`), so enabling them adds no extra providers.
 */
export interface TrailmixClerkControllerOptions {
    /** `GET /account` (info) + `GET /account/global-roles` for the current account. */
    account?: boolean;
    /** `GET /audit/:type/:id` — entity audit history (admin only). */
    audit?: boolean;
    /** `GET /audits/:type/:id` — entity audit history (admin; account or API-key principals). */
    audits?: boolean;
    /** `GET /security-audits` + `GET /security-audits/:id` (admin only). */
    securityAudits?: boolean;
}

/** Options for {@link setupTrailmixClerkAuth}. */
export interface SetupTrailmixClerkAuthOptions {
    /**
     * Toggle optional features: organizations (`enableOrganizations`) and API keys (`apiKeys`). Each
     * adds its collections/services/managers/controllers. Mirrors `@trailmix-cms/cms`'s `FeatureConfig`.
     */
    features?: FeatureConfig;
    /** Opt-in mounting of the account / audit / security-audit controllers (all off by default). */
    controllers?: TrailmixClerkControllerOptions;
}

/** The spreadable pieces {@link setupTrailmixClerkAuth} produces. */
export interface TrailmixClerkAuthSetup {
    /** Modules to register (currently none — included for symmetry with the better-auth setup). */
    imports: NonNullable<ModuleMetadata['imports']>;
    /** Providers: the auth/authz services, collections, managers, and the `AuthGuard`. */
    providers: Provider[];
    /** Controllers: global-roles plus organization / api-key controllers when those features are on. */
    controllers: Type<unknown>[];
}

/**
 * Wires Clerk authentication + the cms-compatible authorization model (principals, global/org roles,
 * API-key scopes) into a Trailmix app. Spread alongside `setupTrailmixCore()` — the collections consume
 * the `@trailmix-cms/db` providers (and the security-audit collection) that core contributes, on the
 * shared connection. It does **not** open its own connection.
 *
 * Protect routes with `@Auth({...})` (attaches the global-capable {@link AuthGuard}); read the principal
 * with `@PrincipalContext()` and the audit context with `@AuditContext()`. Register the Clerk Fastify
 * plugin in your bootstrap: `app.register(clerkPlugin, { secretKey })`.
 *
 * To run a hook when an account is first created, add `provideAuthGuardHook(MyHook)` to your providers;
 * for org cascade-deletes, `provideOrganizationDeleteHook(MyHook)`.
 *
 * @example
 * ```ts
 * const core = setupTrailmixCore({ securityAuditsController: false });
 * const auth = setupTrailmixClerkAuth({ features: { enableOrganizations: true, apiKeys: { enabled: true } } });
 *
 * @Module({
 *   imports: [ConfigModule.forRoot({ isGlobal: true, load: [databaseConfiguration, clerkConfiguration] }), ...core.imports, ...auth.imports],
 *   controllers: [...auth.controllers],
 *   providers: [...core.providers, ...auth.providers],
 * })
 * export class AppModule {}
 * ```
 */
export function setupTrailmixClerkAuth(options: SetupTrailmixClerkAuthOptions = {}): TrailmixClerkAuthSetup {
    const enableOrganizations = options.features?.enableOrganizations === true;
    const apiKeysEnabled = options.features?.apiKeys?.enabled === true;

    const providers: Provider[] = [
        AuthGuard,

        // FeatureService carries the toggles to the services that branch on them.
        { provide: FeatureService, useValue: new FeatureService(options.features) },

        // Always-on auth/authz.
        AccountService,
        AuthService,
        GlobalRoleService,
        AuthorizationService,
        GlobalRoleManager,

        // MongoDB collection tokens. `security-audit` is provided by setupTrailmixCore (reused).
        ...[
            ClerkCollectionName.Account,
            ClerkCollectionName.Role,
            ...(enableOrganizations ? [ClerkCollectionName.Organization] : []),
            ...(apiKeysEnabled ? [ClerkCollectionName.ApiKey] : []),
        ].map((name) => collectionFactory(name)),

        // Collections (SecurityAuditCollection comes from setupTrailmixCore).
        AccountCollection,
        RoleCollection,
        ...(enableOrganizations ? [OrganizationCollection] : []),
        ...(apiKeysEnabled ? [ApiKeyCollection] : []),

        // Feature services/managers.
        ...(enableOrganizations ? [OrganizationService, OrganizationRoleService, OrganizationRoleManager, OrganizationManager] : []),
        ...(apiKeysEnabled ? [ApiKeyService] : []),
    ];

    const controllers: Type<unknown>[] = [GlobalRolesController];
    if (enableOrganizations) {
        controllers.push(OrganizationsController, OrganizationRolesController);
    }
    if (apiKeysEnabled) {
        controllers.push(ApiKeysController);
    }

    // Opt-in controllers — mounted only when requested (all default off).
    const opt = options.controllers ?? {};
    if (opt.account) controllers.push(AccountController);
    if (opt.audit) controllers.push(AuditController);
    if (opt.audits) controllers.push(AuditsController);
    if (opt.securityAudits) controllers.push(SecurityAuditsController);

    return { imports: [], providers, controllers };
}
