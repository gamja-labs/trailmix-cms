import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GreetingResponseSchema = z.object({
    authenticated: z.boolean(),
    message: z.string(),
});
export type GreetingResponseSchema = z.infer<typeof GreetingResponseSchema>;

export class GreetingResponseDto extends createZodDto(GreetingResponseSchema) {}
