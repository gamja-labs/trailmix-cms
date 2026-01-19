export const ApiKeyScope = {
    Account: 'account',
    Organization: 'organization',
    Global: 'global',
} as const;

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope];