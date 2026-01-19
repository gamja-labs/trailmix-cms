export const RoleValue = {
    Owner: "owner",
    Admin: 'admin',
    User: "user",
    Reader: "reader",
    Anonymous: 'anonymous',
} as const;

export type RoleValue = (typeof RoleValue)[keyof typeof RoleValue];