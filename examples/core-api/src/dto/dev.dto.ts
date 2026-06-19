import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RoleChangeResponseSchema = z.object({
    userId: z.string(),
    role: z.string(),
    message: z.string(),
});
export type RoleChangeResponseSchema = z.infer<typeof RoleChangeResponseSchema>;

export class RoleChangeResponseDto extends createZodDto(RoleChangeResponseSchema) {}
