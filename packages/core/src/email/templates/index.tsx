import * as React from 'react';
import { renderEmail, type RenderedEmail } from '../render.js';
import { VerifyEmail, type VerifyEmailProps } from './verify-email.js';
import { ResetPassword, type ResetPasswordProps } from './reset-password.js';
import { MagicLink, type MagicLinkProps } from './magic-link.js';
import {
    OrganizationInvitation,
    type OrganizationInvitationProps,
} from './organization-invitation.js';

export * from './layout.js';
export * from './verify-email.js';
export * from './reset-password.js';
export * from './magic-link.js';
export * from './organization-invitation.js';

/** Render the {@link VerifyEmail} template to `{ subject, html, text }`. */
export async function renderVerifyEmail(props: VerifyEmailProps): Promise<RenderedEmail> {
    return { subject: 'Verify your email address', ...(await renderEmail(<VerifyEmail {...props} />)) };
}

/** Render the {@link ResetPassword} template to `{ subject, html, text }`. */
export async function renderResetPassword(props: ResetPasswordProps): Promise<RenderedEmail> {
    return { subject: 'Reset your password', ...(await renderEmail(<ResetPassword {...props} />)) };
}

/** Render the {@link MagicLink} template to `{ subject, html, text }`. */
export async function renderMagicLink(props: MagicLinkProps): Promise<RenderedEmail> {
    return { subject: 'Your sign-in link', ...(await renderEmail(<MagicLink {...props} />)) };
}

/** Render the {@link OrganizationInvitation} template to `{ subject, html, text }`. */
export async function renderOrganizationInvitation(
    props: OrganizationInvitationProps,
): Promise<RenderedEmail> {
    return {
        subject: `You’ve been invited to join ${props.organizationName}`,
        ...(await renderEmail(<OrganizationInvitation {...props} />)),
    };
}
