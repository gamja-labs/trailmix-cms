import { z } from 'zod';
import * as models from '../models';
import { createZodDto } from 'nestjs-zod';

export const AccountResponseSchema = models.Account.entitySchema.omit({
}).meta({
    id: 'AccountDto',
});

export type AccountResponseSchema = z.input<typeof AccountResponseSchema>;

export class AccountDto extends createZodDto(AccountResponseSchema, { codec: true }) { }