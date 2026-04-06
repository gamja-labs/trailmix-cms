import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SecurityAudit, Principal, SecurityAuditEventType, Codecs } from '@trailmix-cms/models';

export const GetSecurityAuditsQuerySchema = z.object({
    principal_id: Codecs.ObjectId.optional(),
    principal_type: z.enum(Object.values(Principal)).optional(),
    event_type: z.enum(Object.values(SecurityAuditEventType)).optional(),
});
export type GetSecurityAuditsQuerySchema = z.input<typeof GetSecurityAuditsQuerySchema>;
export class GetSecurityAuditsQueryDto extends createZodDto(GetSecurityAuditsQuerySchema, { codec: true }) { }

export const SecurityAuditResponseSchema = SecurityAudit.schema;
export type SecurityAuditResponseSchema = z.input<typeof SecurityAuditResponseSchema>;
export class SecurityAuditResponseDto extends createZodDto(SecurityAuditResponseSchema, { codec: true }) { }

export const SecurityAuditListResponseSchema = z.object({
    items: z.array(SecurityAudit.schema),
    count: z.number(),
});
export type SecurityAuditListResponseSchema = z.input<typeof SecurityAuditListResponseSchema>;
export class SecurityAuditListResponseDto extends createZodDto(SecurityAuditListResponseSchema, { codec: true }) { }
