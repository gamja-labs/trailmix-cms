import * as trailmixModels from '@trailmix-cms/models';

export type RequestPrincipal<
    AccountEntity extends trailmixModels.Account.Entity = trailmixModels.Account.Entity,
> = {
    principal_type: typeof trailmixModels.Principal.ApiKey;
    entity: trailmixModels.ApiKey.Entity;
} | {
    principal_type: typeof trailmixModels.Principal.Account;
    entity: AccountEntity;
}
