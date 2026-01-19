export const CMSCollectionName = {
    Organization: 'organization',
    Role: 'role',
    ApiKey: 'api-key',
    SecurityAudit: 'security-audit',
    Account: 'account',
} as const;

export type CMSCollectionName = typeof CMSCollectionName[keyof typeof CMSCollectionName];
