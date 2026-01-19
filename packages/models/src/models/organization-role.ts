import { z } from 'zod';
import { Codecs } from '../utils';
import { Role } from '../entity';

export const schema = Role.schema.omit({
    type: true,
}).extend({
    organization_id: Codecs.ObjectId,
}).meta({
    id: 'OrganizationRole',
});

export type Model = z.infer<typeof schema>;

