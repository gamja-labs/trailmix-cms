import { ApiKeyScope } from '@trailmix-cms/models';

export interface FeatureConfig {
    enableOrganizations?: boolean;
    apiKeys?: {
        enabled: true;
        scopes?: ApiKeyScope[];
    };
}
