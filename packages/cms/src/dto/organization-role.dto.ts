import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { OrganizationRole, InternalFields } from '@trailmix-cms/models';

export const OrganizationRoleSchema = OrganizationRole.schema
export class OrganizationRoleDto extends createZodDto(OrganizationRoleSchema) { }

export const AssignOrganizationRoleSchema = OrganizationRole.schema.omit(InternalFields)
export class AssignOrganizationRoleDto extends createZodDto(AssignOrganizationRoleSchema) { }

export const GetOrganizationRoleAssignmentsQuerySchema = OrganizationRole.schema.partial()
export class GetOrganizationRoleAssignmentsQueryDto extends createZodDto(GetOrganizationRoleAssignmentsQuerySchema) { }

export const OrganizationRoleListResponseSchema = z.object({
    items: z.array(OrganizationRole.schema),
    count: z.number(),
});
export class OrganizationRoleListResponseDto extends createZodDto(OrganizationRoleListResponseSchema) { }
