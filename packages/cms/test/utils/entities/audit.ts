import { faker } from '@faker-js/faker';
import { Audit } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';
import { createBaseEntity } from '../base';
import { createAuditContext } from '../models/audit-context';

export function createAudit(overrides?: Partial<Audit.Entity>) {
    const entity: Audit.Entity = {
        ...createBaseEntity(),
        entity_id: new ObjectId(),
        entity_type: faker.string.alpha(10),
        action: faker.helpers.arrayElement(['create', 'update', 'delete'] as const),
        context: createAuditContext(),
        ...overrides,
    };
    Audit.schema.encode(entity);
    return entity;
}
