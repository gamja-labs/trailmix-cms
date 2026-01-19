import { z } from 'zod';

export const schema = z.object({
    published: z.boolean().optional(),
});

export type Model = z.infer<typeof schema>;
