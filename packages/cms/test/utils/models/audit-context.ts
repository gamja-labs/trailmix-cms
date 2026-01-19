import { AuditContext } from '@trailmix-cms/models';

export function createAuditContext(overrides?: Partial<AuditContext.Model>) {
    const model: AuditContext.Model = {
        system: true,
        ...overrides,
    };
    AuditContext.schema.encode(model);
    return model;
}
