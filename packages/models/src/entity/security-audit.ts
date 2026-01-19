import { z } from 'zod';
import { baseEntitySchema } from '../base';
import * as Codecs from '../utils/codecs';
import { Principal, SecurityAuditEventType } from '../types';

export const schema = baseEntitySchema.extend({
    event_type: z.enum(Object.values(SecurityAuditEventType)),
    principal_id: Codecs.ObjectId,
    principal_type: z.enum(Object.values(Principal)),
    message: z.string().optional(),
    source: z.string().optional(),
}).meta({
    id: 'SecurityAudit',
});

export type Entity = z.infer<typeof schema>;
