import { z } from 'zod';
import { baseEntitySchema, versionedSchema } from '@trailmix-cms/models';

// A versioned entity: it carries a `version` (from `versionedSchema`) in
// addition to the usual base fields. The VersionedCollection manages the
// `version` automatically — callers never set or bump it directly.
export const entitySchema = baseEntitySchema.extend({
    ...versionedSchema.shape,
    title: z.string().min(1, 'Title is required'),
    body: z.string().optional(),
});

export type Entity = z.infer<typeof entitySchema>;
