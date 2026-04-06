import { z } from 'zod';
import { baseEntitySchema } from '@trailmix-cms/models';

export const entitySchema = baseEntitySchema.extend({
    name: z.string(),
}).meta({
    id: 'TodoList',
});

export type Entity = z.infer<typeof entitySchema>;
