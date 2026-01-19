import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GlobalRole, InternalFields } from '@trailmix-cms/models';

export const GlobalRoleSchema = GlobalRole.schema
export class GlobalRoleDto extends createZodDto(GlobalRoleSchema) { }

export const AssignGlobalRoleSchema = GlobalRole.schema.omit(InternalFields)
export class AssignGlobalRoleDto extends createZodDto(AssignGlobalRoleSchema) { }

export const GetGlobalRoleAssignmentsQuerySchema = GlobalRole.schema.partial()
export class GetGlobalRoleAssignmentsQueryDto extends createZodDto(GetGlobalRoleAssignmentsQuerySchema) { }

export const GlobalRoleListResponseSchema = z.object({
    items: z.array(GlobalRole.schema),
    count: z.number(),
});
export class GlobalRoleListResponseDto extends createZodDto(GlobalRoleListResponseSchema) { }
