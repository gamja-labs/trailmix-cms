import { BaseEntity, baseEntitySchema } from '@trailmix-cms/models';
import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import { ObjectId } from 'mongodb';

export function createBaseEntity() {
    const createdAt = dayjs(faker.date.past()).toDate();
    const updatedAt = dayjs(createdAt).add(1, 'day').toDate();
    const entity: BaseEntity = {
        _id: new ObjectId(),
        created_at: createdAt,
        updated_at: updatedAt,
    };
    baseEntitySchema.encode(entity);
    return entity;
}