import { z } from 'zod';
import { Role } from '../entity';

export const schema = Role.schema.omit({
    type: true,
    organization_id: true,
}).meta({
    id: 'GlobalRole',
});

export type Model = z.infer<typeof schema>;

