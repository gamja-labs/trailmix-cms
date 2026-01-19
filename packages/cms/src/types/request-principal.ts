import * as trailmixModels from '@trailmix-cms/models';

export type RequestPrincipal = {
    principal_type: typeof trailmixModels.Principal.ApiKey;
    entity: trailmixModels.ApiKey.Entity;
} | {
    principal_type: typeof trailmixModels.Principal.Account;
    entity: trailmixModels.Account.Entity;
}
