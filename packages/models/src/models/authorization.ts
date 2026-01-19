
import { z } from 'zod';
import * as Codecs from '../utils/codecs';
import { Principal } from '../types';

export const schema = z.object({
    authorization: z.object({
        public: z.boolean().optional(),
        roles: z.array(z.string()).optional(),
        principals: z.array(z.object({
            id: Codecs.ObjectId,
            type: z.enum(Object.values(Principal)),
        })).optional(),
    }).optional(),
}).meta({
    id: 'Authorization',
});

export type Model = z.infer<typeof schema>;