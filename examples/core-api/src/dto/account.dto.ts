import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// `whoami` reads the user/session better-auth attaches to the request. Those fields are absent
// until the AuthGuard resolves a session, so each is optional.
export const WhoamiResponseSchema = z.object({
    userId: z.string().optional(),
    email: z.string().optional(),
    sessionId: z.string().optional(),
});
export type WhoamiResponseSchema = z.infer<typeof WhoamiResponseSchema>;

export class WhoamiResponseDto extends createZodDto(WhoamiResponseSchema) {}
