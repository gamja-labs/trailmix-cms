import { faker } from '@faker-js/faker';
import { GlobalRole, Principal, RoleValue } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';

export function createGlobalRoleModel(overrides?: Partial<GlobalRole.Model>) {
    const model: GlobalRole.Model = {
        _id: new ObjectId(),
        created_at: new Date(),
        principal_id: new ObjectId(),
        principal_type: faker.helpers.arrayElement(Object.values(Principal)),
        role: faker.helpers.arrayElement([
            RoleValue.Owner,
            RoleValue.Admin,
            RoleValue.User,
            RoleValue.Reader,
        ]),
        updated_at: faker.date.recent(),
        ...overrides,
    };
    GlobalRole.schema.encode(model);
    return model;
}
