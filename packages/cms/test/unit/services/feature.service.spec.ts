import { ApiKeyScope } from '@trailmix-cms/models';

import { FeatureService } from '@/services/feature.service';
import { FeatureConfig } from '@/types';

describe('FeatureService', () => {
    let service: FeatureService;

    describe('isOrganizationsEnabled', () => {
        it('returns true when enableOrganizations is true', () => {
            service = new FeatureService({ enableOrganizations: true });
            expect(service.isOrganizationsEnabled()).toBe(true);
        });

        it('returns false when enableOrganizations is undefined', () => {
            service = new FeatureService();
            expect(service.isOrganizationsEnabled()).toBe(false);
        });
    });

    describe('isApiKeysEnabled', () => {
        it('returns true when apiKeys.enabled is true', () => {
            service = new FeatureService({ apiKeys: { enabled: true } });
            expect(service.isApiKeysEnabled()).toBe(true);
        });

        it('returns false when apiKeys is undefined', () => {
            service = new FeatureService();
            expect(service.isApiKeysEnabled()).toBe(false);
        });
    });

    describe('getApiKeyScopes', () => {
        it('returns scopes when apiKeys.scopes is defined', () => {
            const scopes = [ApiKeyScope.Account, ApiKeyScope.Organization];
            service = new FeatureService({ apiKeys: { enabled: true, scopes } });
            expect(service.getApiKeyScopes()).toEqual(scopes);
        });

        it('returns empty array when apiKeys.scopes is undefined', () => {
            service = new FeatureService();
            expect(service.getApiKeyScopes()).toEqual([]);
        });
    });

    describe('getFeatures', () => {
        it('returns copy of features config', () => {
            const config: FeatureConfig = {
                enableOrganizations: true,
                apiKeys: { enabled: true, scopes: [ApiKeyScope.Account] },
            };
            service = new FeatureService(config);
            expect(service.getFeatures()).toEqual(config);
        });
    });
});
