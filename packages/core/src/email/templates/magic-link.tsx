import * as React from 'react';
import { ActionButton, EmailBranding, EmailLayout, Paragraph } from './layout.js';

export interface MagicLinkProps extends EmailBranding {
    /** The sign-in URL (contains the token). */
    url: string;
    /** The user signing in — `name` personalizes the greeting when present. */
    user?: { name?: string; email?: string };
}

/** Sign-in template for the better-auth `magicLink` plugin's `sendMagicLink` flow. */
export function MagicLink({ url, user, productName, accentColor }: MagicLinkProps) {
    return (
        <EmailLayout preview="Your sign-in link" heading="Sign in" productName={productName}>
            <Paragraph>
                {user?.name ? `Hi ${user.name},` : 'Hi,'} click the button below to sign in. No password
                required.
            </Paragraph>
            <ActionButton url={url} label="Sign in" accentColor={accentColor} />
            <Paragraph>This link is single-use and expires shortly.</Paragraph>
        </EmailLayout>
    );
}
