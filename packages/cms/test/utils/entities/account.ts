import { faker } from '@faker-js/faker';
import { Account } from '@trailmix-cms/models';
import { createBaseEntity } from '../base';

export function createAccount(overrides?: Partial<Account.Entity>) {
    const entity: Account.Entity = {
        ...createBaseEntity(),
        user_id: faker.string.uuid(),
        ...overrides,
    };
    Account.schema.encode(entity);
    return entity;
}
