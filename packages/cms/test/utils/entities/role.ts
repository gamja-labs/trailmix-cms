import { faker } from '@faker-js/faker';
import { Role } from '@trailmix-cms/models';
import { createBaseEntity } from '../base';
import { RoleType } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';
import { Principal } from '@trailmix-cms/models';
import { RoleValue } from '@trailmix-cms/models';

export function createRole(overrides?: Partial<Role.Entity>) {
    const entity: Role.Entity = {
        ...createBaseEntity(),
        type: faker.helpers.arrayElement(Object.values(RoleType)),
        principal_id: new ObjectId(),
        principal_type: faker.helpers.arrayElement(Object.values(Principal)),
        organization_id: new ObjectId(),
        role: faker.helpers.arrayElement(Object.values(RoleValue)),
        ...overrides,
    };
    Role.schema.encode(entity);
    return entity;
}
