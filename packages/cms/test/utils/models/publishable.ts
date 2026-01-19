import { Publishable } from '@trailmix-cms/models';

export function createPublishable(overrides?: Partial<Publishable.Model>) {
    return Publishable.schema.parse({
        ...overrides,
    });
}
