import { z } from 'zod';
import { Account } from '@trailmix-cms/models';

// extend the base account schema
export const entitySchema = Account.schema.extend({
    name: z.string(),
});

export type Entity = z.infer<typeof entitySchema>;