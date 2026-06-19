import * as React from 'react';
import { ActionButton, EmailBranding, EmailLayout, Paragraph } from './layout.js';

export interface VerifyEmailProps extends EmailBranding {
    /** The verification URL (contains the token). */
    url: string;
    /** The user being verified — `name` personalizes the greeting when present. */
    user?: { name?: string; email?: string };
}

/** Email-verification template for the better-auth `emailVerification.sendVerificationEmail` flow. */
export function VerifyEmail({ url, user, productName, accentColor }: VerifyEmailProps) {
    return (
        <EmailLayout preview="Verify your email address" heading="Verify your email" productName={productName}>
            <Paragraph>
                {user?.name ? `Hi ${user.name},` : 'Hi,'} confirm this is your email address to finish
                setting up your account.
            </Paragraph>
            <ActionButton url={url} label="Verify email" accentColor={accentColor} />
            <Paragraph>This link expires soon, so verify while it’s fresh.</Paragraph>
        </EmailLayout>
    );
}
