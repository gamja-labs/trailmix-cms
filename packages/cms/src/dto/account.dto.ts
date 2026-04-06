import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GlobalRole } from '@trailmix-cms/models';

export const AccountGlobalRoleListResponseSchema = z.object({
    items: z.array(GlobalRole.schema),
    count: z.number(),
});
export type AccountGlobalRoleListResponseSchema = z.input<typeof AccountGlobalRoleListResponseSchema>;
export class AccountGlobalRoleListResponseDto extends createZodDto(AccountGlobalRoleListResponseSchema, { codec: true }) { }
