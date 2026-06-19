import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Account, GlobalRole } from '@trailmix-cms/models';

export const AccountResponseSchema = Account.schema;
export type AccountResponseSchema = z.input<typeof AccountResponseSchema>;
export class AccountResponseDto extends createZodDto(AccountResponseSchema, { codec: true }) { }

export const AccountGlobalRoleListResponseSchema = z.object({
    items: z.array(GlobalRole.schema),
    count: z.number(),
});
export type AccountGlobalRoleListResponseSchema = z.input<typeof AccountGlobalRoleListResponseSchema>;
export class AccountGlobalRoleListResponseDto extends createZodDto(AccountGlobalRoleListResponseSchema, { codec: true }) { }
