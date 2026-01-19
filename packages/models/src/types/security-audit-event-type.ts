export const SecurityAuditEventType = {
    UnauthorizedAccess: 'unauthorized_access',
} as const;

export type SecurityAuditEventType = (typeof SecurityAuditEventType)[keyof typeof SecurityAuditEventType];
