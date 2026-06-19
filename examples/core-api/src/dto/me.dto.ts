import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Codecs } from '@trailmix-cms/models';

// better-auth owns the user/session shapes, and the enabled plugins (admin, organization) add
// their own fields. These schemas document the common fields while staying permissive
// (`looseObject` keeps any extra keys better-auth returns). Date fields use the shared `DateTime`
// codec so they serialize to ISO strings and render as date-times in the OpenAPI spec.
export const MeUserSchema = z.looseObject({
    id: z.string(),
    name: z.string().nullish(),
    email: z.string(),
    emailVerified: z.boolean().optional(),
    image: z.string().nullish(),
    role: z.union([z.string(), z.array(z.string())]).nullish(),
    createdAt: Codecs.DateTime.optional(),
    updatedAt: Codecs.DateTime.optional(),
});

export const MeSessionSchema = z.looseObject({
    id: z.string(),
    userId: z.string(),
    token: z.string().optional(),
    expiresAt: Codecs.DateTime.optional(),
    createdAt: Codecs.DateTime.optional(),
    updatedAt: Codecs.DateTime.optional(),
    ipAddress: z.string().nullish(),
    userAgent: z.string().nullish(),
    activeOrganizationId: z.string().nullish(),
});

export const MeResponseSchema = z.object({
    user: MeUserSchema,
    session: MeSessionSchema,
});
export type MeResponseSchema = z.infer<typeof MeResponseSchema>;

export class MeResponseDto extends createZodDto(MeResponseSchema, { codec: true }) {}
