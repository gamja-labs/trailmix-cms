import { z } from 'zod';

export const versionedSchema = z.object({
    version: z.number().int().nonnegative(),
});

export type Versioned = z.infer<typeof versionedSchema>;
