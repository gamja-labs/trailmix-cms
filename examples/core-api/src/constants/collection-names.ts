export const CollectionName = {
    Note: 'note',
} as const;

export type CollectionName = typeof CollectionName[keyof typeof CollectionName];
