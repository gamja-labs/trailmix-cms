import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StatusResponseSchema = z.object({
    status: z.string(),
    version: z.string(),
});
export type StatusResponseSchema = z.infer<typeof StatusResponseSchema>;

export class StatusResponseDto extends createZodDto(StatusResponseSchema) {}
