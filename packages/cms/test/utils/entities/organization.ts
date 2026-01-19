import { faker } from '@faker-js/faker';
import { Organization } from '@trailmix-cms/models';
import { createBaseEntity } from '../base';

export function createOrganization(overrides?: Partial<Organization.Entity>) {
    const entity: Organization.Entity = {
        ...createBaseEntity(),
        name: faker.company.name(),
        ...overrides,
    };
    Organization.schema.encode(entity);
    return entity;
}
