import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SecurityAudit, Principal, SecurityAuditEventType, Codecs } from '@trailmix-cms/models';

export const GetSecurityAuditsQuerySchema = z.object({
    principal_id: Codecs.ObjectId.optional(),
    principal_type: z.enum(Object.values(Principal)).optional(),
    event_type: z.enum(Object.values(SecurityAuditEventType)).optional(),
});

export class GetSecurityAuditsQueryDto extends createZodDto(GetSecurityAuditsQuerySchema) { }

export const SecurityAuditResponseSchema = SecurityAudit.schema;
export class SecurityAuditResponseDto extends createZodDto(SecurityAuditResponseSchema) { }

export const SecurityAuditListResponseSchema = z.object({
    items: z.array(SecurityAudit.schema),
    count: z.number(),
});

export class SecurityAuditListResponseDto extends createZodDto(SecurityAuditListResponseSchema) { }
