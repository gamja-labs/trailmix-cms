import { z } from 'zod';
import { baseEntitySchema, Codecs } from '@trailmix-cms/models';

export const entitySchema = baseEntitySchema.extend({
    list_id: Codecs.ObjectId,
    text: z.string().min(1, 'Item text is required'),
    completed: z.boolean().optional(),
});

export type Entity = z.infer<typeof entitySchema>;