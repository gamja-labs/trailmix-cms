import { z } from 'zod';
import * as models from '../models';
import { createZodDto } from 'nestjs-zod';

export const entitySchema = models.Account.entitySchema.omit({
}).meta({
    id: 'AccountDto',
});

export type Entity = z.infer<typeof entitySchema>;

export class AccountDto extends createZodDto(entitySchema) { }