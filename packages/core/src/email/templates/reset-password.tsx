import * as React from 'react';
import { ActionButton, EmailBranding, EmailLayout, Paragraph } from './layout.js';

export interface ResetPasswordProps extends EmailBranding {
    /** The password-reset URL (contains the token). */
    url: string;
    /** The user requesting the reset — `name` personalizes the greeting when present. */
    user?: { name?: string; email?: string };
}

/** Password-reset template for the better-auth `emailAndPassword.sendResetPassword` flow. */
export function ResetPassword({ url, user, productName, accentColor }: ResetPasswordProps) {
    return (
        <EmailLayout preview="Reset your password" heading="Reset your password" productName={productName}>
            <Paragraph>
                {user?.name ? `Hi ${user.name},` : 'Hi,'} we received a request to reset your password.
                Choose a new one using the button below.
            </Paragraph>
            <ActionButton url={url} label="Reset password" accentColor={accentColor} />
            <Paragraph>
                If you didn’t request this, no action is needed — your password stays the same.
            </Paragraph>
        </EmailLayout>
    );
}
