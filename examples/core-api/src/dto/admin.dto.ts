import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdminOverviewResponseSchema = z.object({
    message: z.string(),
    you: z.string(),
    // The better-auth admin plugin types a role as a single role or a list of roles.
    role: z.union([z.string(), z.array(z.string())]).nullish(),
});
export type AdminOverviewResponseSchema = z.infer<typeof AdminOverviewResponseSchema>;

export class AdminOverviewResponseDto extends createZodDto(AdminOverviewResponseSchema) {}
