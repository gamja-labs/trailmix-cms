export const CoreCollectionName = {
    SecurityAudit: 'security-audit',
} as const;

export type CoreCollectionName = typeof CoreCollectionName[keyof typeof CoreCollectionName];
