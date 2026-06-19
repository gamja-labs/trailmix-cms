import * as React from 'react';
import { ActionButton, EmailBranding, EmailLayout, Paragraph } from './layout.js';

export interface OrganizationInvitationProps extends EmailBranding {
    /** The accept-invitation URL. */
    url: string;
    /** Name of the organization the recipient is invited to. */
    organizationName: string;
    /** Name (or email) of the person who sent the invite. */
    inviterName?: string;
    /** The role being offered (e.g. `"member"`, `"admin"`). */
    role?: string;
}

/** Invitation template for the better-auth `organization` plugin's `sendInvitationEmail` flow. */
export function OrganizationInvitation({
    url,
    organizationName,
    inviterName,
    role,
    productName,
    accentColor,
}: OrganizationInvitationProps) {
    return (
        <EmailLayout
            preview={`You’ve been invited to join ${organizationName}`}
            heading={`Join ${organizationName}`}
            productName={productName}
        >
            <Paragraph>
                {inviterName ? `${inviterName} invited you` : 'You’ve been invited'} to join{' '}
                <strong>{organizationName}</strong>
                {role ? ` as ${role}` : ''}.
            </Paragraph>
            <ActionButton url={url} label="Accept invitation" accentColor={accentColor} />
            <Paragraph>If you don’t want to join, you can ignore this email.</Paragraph>
        </EmailLayout>
    );
}
