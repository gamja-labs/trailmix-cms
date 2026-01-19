import { Organization } from '@trailmix-cms/models';
import { z } from 'zod';

// extend the base account schema
export const entitySchema = Organization.schema.extend({
    description: z.string(),
});

export type Entity = z.infer<typeof entitySchema>;