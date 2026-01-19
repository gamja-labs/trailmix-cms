import { faker } from '@faker-js/faker';
import { SecurityAudit, Principal, SecurityAuditEventType } from '@trailmix-cms/models';
import { ObjectId } from 'mongodb';
import { createBaseEntity } from '../base';

export function createSecurityAudit(overrides?: Partial<SecurityAudit.Entity>) {
    const entity: SecurityAudit.Entity = {
        ...createBaseEntity(),
        event_type: faker.helpers.arrayElement(Object.values(SecurityAuditEventType)),
        principal_id: new ObjectId(),
        principal_type: faker.helpers.arrayElement(Object.values(Principal)),
        ...overrides,
    };
    SecurityAudit.schema.encode(entity);
    return entity;
}
