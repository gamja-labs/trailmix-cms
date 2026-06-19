import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GlobalRole, InternalFields } from '@trailmix-cms/models';

export const GlobalRoleSchema = GlobalRole.schema
export type GlobalRoleSchema = z.input<typeof GlobalRoleSchema>;
export class GlobalRoleDto extends createZodDto(GlobalRoleSchema, { codec: true }) { }

export const AssignGlobalRoleSchema = GlobalRole.schema.omit(InternalFields)
export type AssignGlobalRoleSchema = z.input<typeof AssignGlobalRoleSchema>;
export class AssignGlobalRoleDto extends createZodDto(AssignGlobalRoleSchema, { codec: true }) { }

export const GetGlobalRoleAssignmentsQuerySchema = GlobalRole.schema.partial()
export type GetGlobalRoleAssignmentsQuerySchema = z.input<typeof GetGlobalRoleAssignmentsQuerySchema>;
export class GetGlobalRoleAssignmentsQueryDto extends createZodDto(GetGlobalRoleAssignmentsQuerySchema, { codec: true }) { }

export const GlobalRoleListResponseSchema = z.object({
    items: z.array(GlobalRole.schema),
    count: z.number(),
});
export type GlobalRoleListResponseSchema = z.input<typeof GlobalRoleListResponseSchema>;
export class GlobalRoleListResponseDto extends createZodDto(GlobalRoleListResponseSchema, { codec: true }) { }
