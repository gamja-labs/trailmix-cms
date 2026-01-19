import { faker } from '@faker-js/faker';
import { Mapping } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';
import { createBaseEntity } from '../base';

export function createMapping(overrides?: Partial<Mapping.Entity>) {
    const firstCollection = faker.helpers.arrayElement(['account', 'organization', 'file']);
    const secondCollection = faker.helpers.arrayElement(['text', 'file', 'organization']);
    
    const entity: Mapping.Entity = {
        ...createBaseEntity(),
        first_collection: firstCollection,
        first_id: new ObjectId(),
        second_collection: secondCollection,
        second_id: new ObjectId(),
        ...overrides,
    };
    Mapping.schema.encode(entity);
    return entity;
}
