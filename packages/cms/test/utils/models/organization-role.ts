import { faker } from '@faker-js/faker';
import { OrganizationRole, Principal, RoleValue } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';

export function createOrganizationRoleModel(overrides?: Partial<OrganizationRole.Model>) {
    const model: OrganizationRole.Model = {
        _id: new ObjectId(),
        created_at: new Date(),
        principal_id: new ObjectId(),
        principal_type: faker.helpers.arrayElement(Object.values(Principal)),
        organization_id: new ObjectId(),
        role: faker.helpers.arrayElement([
            RoleValue.Owner,
            RoleValue.Admin,
            RoleValue.User,
            RoleValue.Reader,
        ]),
        updated_at: faker.date.recent(),
        ...overrides,
    };
    OrganizationRole.schema.encode(model);
    return model;
}
