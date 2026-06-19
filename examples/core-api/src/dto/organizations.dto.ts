import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ActiveOrgSettingsResponseSchema = z.object({
    activeOrganizationId: z.string().nullish(),
    message: z.string(),
});
export type ActiveOrgSettingsResponseSchema = z.infer<typeof ActiveOrgSettingsResponseSchema>;

export class ActiveOrgSettingsResponseDto extends createZodDto(ActiveOrgSettingsResponseSchema) {}
