export const InternalCollectionName = {
    Audit: 'audit',
    Revision: 'revision',
} as const;

export type InternalCollectionName = typeof InternalCollectionName[keyof typeof InternalCollectionName];
