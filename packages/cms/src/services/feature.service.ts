import { Injectable } from '@nestjs/common';
import { ApiKeyScope } from '@trailmix-cms/models';
import { type FeatureConfig } from '../types';

@Injectable()
export class FeatureService {
    private readonly features: FeatureConfig;

    constructor(features: FeatureConfig = {}) {
        this.features = features;
    }

    /**
     * Check if the organizations feature is enabled
     */
    isOrganizationsEnabled(): boolean {
        return this.features.enableOrganizations === true;
    }

    /**
     * Check if the API keys feature is enabled
     */
    isApiKeysEnabled(): boolean {
        return this.features.apiKeys?.enabled === true;
    }

    /**
     * Get the allowed API key scopes
     */
    getApiKeyScopes(): ApiKeyScope[] {
        return this.features.apiKeys?.scopes ?? [];
    }

    /**
     * Get all feature configurations
     */
    getFeatures(): FeatureConfig {
        return { ...this.features };
    }
}
