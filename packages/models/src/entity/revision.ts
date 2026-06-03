import { z } from 'zod';
import { baseEntitySchema } from '../base';
import * as AuditContext from '../models/audit-context';
import * as Codecs from '../utils/codecs';

export const schema = baseEntitySchema.extend({
    entity_id: Codecs.ObjectId,
    entity_type: z.string(),
    action: z.enum(['create', 'update', 'delete']),
    context: AuditContext.schema,
    before: z.unknown().nullable().optional(),
    after: z.unknown().nullable().optional(),
    query: z.unknown().optional(),
    update: z.unknown().optional(),
}).meta({
    id: 'Revision',
});

export type Entity = z.infer<typeof schema>;
