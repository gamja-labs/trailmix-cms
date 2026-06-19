import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { OrganizationRole, InternalFields } from '@trailmix-cms/models';

export const OrganizationRoleSchema = OrganizationRole.schema
export type OrganizationRoleSchema = z.input<typeof OrganizationRoleSchema>;
export class OrganizationRoleDto extends createZodDto(OrganizationRoleSchema, { codec: true }) { }

export const AssignOrganizationRoleSchema = OrganizationRole.schema.omit(InternalFields)
export type AssignOrganizationRoleSchema = z.input<typeof AssignOrganizationRoleSchema>;
export class AssignOrganizationRoleDto extends createZodDto(AssignOrganizationRoleSchema, { codec: true }) { }

export const GetOrganizationRoleAssignmentsQuerySchema = OrganizationRole.schema.partial()
export type GetOrganizationRoleAssignmentsQuerySchema = z.input<typeof GetOrganizationRoleAssignmentsQuerySchema>;
export class GetOrganizationRoleAssignmentsQueryDto extends createZodDto(GetOrganizationRoleAssignmentsQuerySchema, { codec: true }) { }

export const OrganizationRoleListResponseSchema = z.object({
    items: z.array(OrganizationRole.schema),
    count: z.number(),
});
export type OrganizationRoleListResponseSchema = z.input<typeof OrganizationRoleListResponseSchema>;
export class OrganizationRoleListResponseDto extends createZodDto(OrganizationRoleListResponseSchema, { codec: true }) { }
