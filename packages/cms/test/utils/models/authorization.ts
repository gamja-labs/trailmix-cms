import { Authorization } from '@trailmix-cms/models';

export function createAuthorization(overrides?: Partial<Authorization.Model>) {
    return Authorization.schema.parse({
        ...overrides,
    });
}
