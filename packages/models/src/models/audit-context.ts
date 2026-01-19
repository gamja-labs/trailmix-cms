
import { z } from 'zod';
import * as Codecs from '../utils/codecs';
import { Principal } from '../types';

export const schema = z.object({
    principal_id: Codecs.ObjectId.optional(),
    principal_type: z.enum(Object.values(Principal)).optional(),
    anonymous: z.boolean().optional(),
    system: z.boolean(),
    source: z.string().optional(),
    message: z.string().optional(),
}).meta({
    id: 'AuditContext',
});

export type Model = z.infer<typeof schema>;