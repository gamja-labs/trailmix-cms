import { render } from '@react-email/render';
import type { ReactElement } from 'react';

/** An email rendered to the shapes {@link import('./sender.js').EmailMessage} needs. */
export interface RenderedEmail {
    /** Subject line for the message. */
    subject: string;
    /** Rendered HTML body. */
    html: string;
    /** Rendered plain-text body. */
    text: string;
}

/**
 * Render a react-email element to both HTML and plain text in one call.
 *
 * Template helpers in {@link import('./templates/index.js')} use this to produce a
 * {@link RenderedEmail}; pair it with a `subject` to get something an `EmailSender` can deliver.
 */
export async function renderEmail(element: ReactElement): Promise<{ html: string; text: string }> {
    const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
    ]);
    return { html, text };
}
