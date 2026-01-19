import { z } from 'zod';
import { baseEntitySchema, Codecs } from '@trailmix-cms/models';

export const entitySchema = baseEntitySchema.extend({
    name: z.string(),
    organization_id: Codecs.ObjectId,
}).meta({
    id: 'TodoList',
});

export type Entity = z.infer<typeof entitySchema>;