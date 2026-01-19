export const RoleType = {
    Organization: 'organization',
    Global: 'global',
} as const;

export type RoleType = (typeof RoleType)[keyof typeof RoleType];