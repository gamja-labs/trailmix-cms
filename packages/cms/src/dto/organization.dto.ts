import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Organization } from '@trailmix-cms/models';

export const OrganizationResponseSchema = Organization.schema;
export class OrganizationResponseDto extends createZodDto(OrganizationResponseSchema) { }

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});
export class CreateOrganizationDto extends createZodDto(CreateOrganizationSchema) { }

export const UpdateOrganizationSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
});
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }

export const OrganizationListResponseSchema = z.object({
    items: z.array(Organization.schema),
    count: z.number(),
});
export class OrganizationListResponseDto extends createZodDto(OrganizationListResponseSchema) { }
