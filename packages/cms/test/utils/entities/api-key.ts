import { faker } from '@faker-js/faker';
import { ApiKey, ApiKeyScope } from '@trailmix-cms/models';
import { createBaseEntity } from '../base';

export function createApiKey(overrides?: Partial<ApiKey.Entity>) {
    const entity: ApiKey.Entity = {
        ...createBaseEntity(),
        api_key: faker.string.alphanumeric(32),
        name: faker.word.noun(),
        scope_type: ApiKeyScope.Global,
        ...overrides,
    };
    ApiKey.schema.encode(entity);
    return entity;
}
