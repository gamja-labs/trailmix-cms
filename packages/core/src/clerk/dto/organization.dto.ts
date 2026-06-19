import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Organization } from '@trailmix-cms/models';

export const OrganizationResponseSchema = Organization.schema;
export type OrganizationResponseSchema = z.input<typeof OrganizationResponseSchema>;
export class OrganizationResponseDto extends createZodDto(OrganizationResponseSchema, { codec: true }) { }

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});
export type CreateOrganizationSchema = z.input<typeof CreateOrganizationSchema>;
export class CreateOrganizationDto extends createZodDto(CreateOrganizationSchema) { }

export const UpdateOrganizationSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});
export type UpdateOrganizationSchema = z.input<typeof UpdateOrganizationSchema>;
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }

export const OrganizationListResponseSchema = z.object({
    items: z.array(Organization.schema),
    count: z.number(),
});
export type OrganizationListResponseSchema = z.input<typeof OrganizationListResponseSchema>;
export class OrganizationListResponseDto extends createZodDto(OrganizationListResponseSchema, { codec: true }) { }
