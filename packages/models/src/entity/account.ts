import { z } from 'zod';
import { baseEntitySchema } from '../base';

export const schema = baseEntitySchema.extend({
    user_id: z.string(),
}).meta({
    id: 'BaseAccount',
});

export type Entity = z.infer<typeof schema>;
