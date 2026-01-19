import { z } from 'zod';
import { baseEntitySchema } from '../base';

export const schema = baseEntitySchema.extend({
    name: z.string(),
}).meta({
    id: 'Organization',
});

export type Entity = z.infer<typeof schema>;
