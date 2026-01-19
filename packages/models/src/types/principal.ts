export const Principal = {
    Account: 'account',
    ApiKey: 'api_key',
} as const;

export type Principal = (typeof Principal)[keyof typeof Principal];