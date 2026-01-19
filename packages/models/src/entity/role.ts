import { z } from 'zod';
import { baseEntitySchema } from '../base';
import * as Codecs from '../utils/codecs';
import { Principal, RoleType } from '../types';

export const schema = baseEntitySchema.extend({
    type: z.enum(Object.values(RoleType)),
    principal_id: Codecs.ObjectId,
    principal_type: z.enum(Object.values(Principal)),
    organization_id: Codecs.ObjectId.optional(),
    role: z.string(),
}).meta({
    id: 'Role',
});

export type Entity = z.infer<typeof schema>;