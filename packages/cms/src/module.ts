import { OptionalUnlessRequiredId, Collection } from 'mongodb';
import { ZodType } from 'zod';
import * as models from '@trailmix-cms/models';
import { createDatabaseProviders } from '@trailmix-cms/db';
import { PROVIDER_SYMBOLS } from './constants';
import { CMSCollectionName } from './constants';
import { collectionFactory } from '@trailmix-cms/db';
import { type CollectionConfig } from './types';

import * as Collections from './collections';
import * as Services from './services';
import * as Managers from './managers';
import { type FeatureConfig } from './types';
import { Controllers } from '.';

const defaultCollectionConfig: CollectionConfig = {
    disableDefaultIndexes: false
}

export interface TrailmixCMSOptions<
    AccountEntity extends models.Account.Entity = models.Account.Entity,
    AccountDtoEntity = AccountEntity,

    OrganizationEntity extends models.Organization.Entity = models.Organization.Entity,
    OrganizationDtoEntity = OrganizationEntity,
> {
    entities?: {
        accountSchema?: ZodType<OptionalUnlessRequiredId<AccountEntity>>,
        accountSetup?: (collection: Collection<AccountEntity>) => Promise<void>,
        accountDtoSchema?: ZodType<OptionalUnlessRequiredId<AccountDtoEntity>>,
        accountMapEntity?: (entity: AccountEntity) => AccountDtoEntity,
        accountConfig?: CollectionConfig,

        organizationSchema?: ZodType<OptionalUnlessRequiredId<OrganizationEntity>>,
        organizationSetup?: (collection: Collection<OrganizationEntity>) => Promise<void>,
        organizationDtoSchema?: ZodType<OptionalUnlessRequiredId<OrganizationDtoEntity>>,
        organizationMapEntity?: (entity: OrganizationEntity) => OrganizationDtoEntity,
        organizationConfig?: CollectionConfig,
    },
    features?: FeatureConfig
}

export function setupTrailmixCMS<
    AccountEntity extends models.Account.Entity = models.Account.Entity,
    AccountDtoEntity = AccountEntity,

    OrganizationEntity extends models.Organization.Entity = models.Organization.Entity,
    OrganizationDtoEntity = OrganizationEntity,

>(options?: TrailmixCMSOptions<
    AccountEntity,
    AccountDtoEntity,
    OrganizationEntity,
    OrganizationDtoEntity
>) {
    const providers = [
        // Database Library Providers
        ...createDatabaseProviders(),

        // Services
        {
            provide: Services.FeatureService,
            useValue: new Services.FeatureService(options?.features),
        },
        Services.AccountService,
        Services.AuthService,
        Services.GlobalRoleService,
        Managers.GlobalRoleManager,

        // MongoDB Collections
        ...Object.values([
            CMSCollectionName.Account,
            CMSCollectionName.Role,
            CMSCollectionName.SecurityAudit,
            ...(options?.features?.enableOrganizations ? [CMSCollectionName.Organization] : []),
            ...(options?.features?.apiKeys?.enabled ? [CMSCollectionName.ApiKey] : []),
        ]).map(collectionName => collectionFactory(collectionName)),

        // Collections
        ...[
            Collections.AccountCollection,
            Collections.RoleCollection,
            Collections.SecurityAuditCollection,
            ...(options?.features?.enableOrganizations ? [Collections.OrganizationCollection] : []),
            ...(options?.features?.apiKeys?.enabled ? [Collections.ApiKeyCollection] : []),
        ],

        // Features
        ...(options?.features?.enableOrganizations ? [Services.OrganizationService, Services.OrganizationRoleService, Managers.OrganizationRoleManager, Managers.OrganizationManager, Services.AuthorizationService, Collections.OrganizationCollection] : []),
        ...(options?.features?.apiKeys?.enabled ? [Services.ApiKeyService, Collections.ApiKeyCollection] : []),

        // Account
        ...[
            {
                provide: PROVIDER_SYMBOLS.ACCOUNT_SCHEMA,
                useValue: options?.entities?.accountSchema ?? models.Account.schema
            },
            ...(options?.entities?.accountSetup ? [{
                provide: PROVIDER_SYMBOLS.ACCOUNT_SETUP,
                useValue: options.entities.accountSetup
            }] : []),
            {
                provide: PROVIDER_SYMBOLS.ACCOUNT_CONFIG,
                useValue: options?.entities?.accountConfig ?? defaultCollectionConfig
            },
            {
                provide: PROVIDER_SYMBOLS.ACCOUNT_MAP_ENTITY,
                useValue: options?.entities?.accountMapEntity ?? (entity => entity)
            },
        ],
        // Organization
        ...(options?.features?.enableOrganizations ? [
            {
                provide: PROVIDER_SYMBOLS.ORGANIZATION_SCHEMA,
                useValue: options?.entities?.organizationSchema ?? models.Organization.schema
            },
            ...(options?.entities?.organizationSetup ? [{
                provide: PROVIDER_SYMBOLS.ORGANIZATION_SETUP,
                useValue: options.entities.organizationSetup
            }] : []),
            {
                provide: PROVIDER_SYMBOLS.ORGANIZATION_CONFIG,
                useValue: options?.entities?.organizationConfig ?? defaultCollectionConfig
            },
            {
                provide: PROVIDER_SYMBOLS.ORGANIZATION_MAP_ENTITY,
                useValue: options?.entities?.organizationMapEntity ?? (entity => entity)
            },
        ] : []),
    ];

    const controllers: any[] = [
        Controllers.AccountController,
        Controllers.AuditsController,
        Controllers.GlobalRolesController,
        Controllers.SecurityAuditsController
    ];
    if (options?.features?.enableOrganizations) {
        controllers.push(Controllers.OrganizationsController, Controllers.OrganizationRolesController);
    }
    if (options?.features?.apiKeys?.enabled) {
        controllers.push(Controllers.ApiKeysController);
    }

    return {
        providers,
        controllers
    };
}