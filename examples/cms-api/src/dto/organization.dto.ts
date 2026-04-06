import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { InternalFields } from '@trailmix-cms/models';
import { entitySchema as OrganizationEntitySchema } from '../models/organization';

export const OrganizationResponseSchema = OrganizationEntitySchema;
export type OrganizationResponseSchema = z.input<typeof OrganizationResponseSchema>;
export class OrganizationResponseDto extends createZodDto(OrganizationResponseSchema, { codec: true }) { }

export const UpdateOrganizationSchema = OrganizationEntitySchema.omit(InternalFields).partial();
export type UpdateOrganizationSchema = z.input<typeof UpdateOrganizationSchema>;
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema, { codec: true }) { }

export const OrganizationListResponseSchema = z.object({
    items: z.array(OrganizationEntitySchema),
    count: z.number(),
});
export type OrganizationListResponseSchema = z.input<typeof OrganizationListResponseSchema>;
export class OrganizationListResponseDto extends createZodDto(OrganizationListResponseSchema, { codec: true }) { }
