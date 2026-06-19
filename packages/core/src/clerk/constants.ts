export const ClerkCollectionName = {
    /** Local account records, keyed by the Clerk user id (`user_id`). */
    Account: 'account',
    Organization: 'organization',
    Role: 'role',
    ApiKey: 'api-key',
    SecurityAudit: 'security-audit',
} as const;

export type ClerkCollectionName = typeof ClerkCollectionName[keyof typeof ClerkCollectionName];
