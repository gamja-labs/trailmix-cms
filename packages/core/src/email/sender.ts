/**
 * A single transactional email to dispatch.
 *
 * Templates render to `subject` / `html` / `text`; the {@link EmailSender} is responsible
 * only for delivery. `from` falls back to the sender's configured default when omitted.
 */
export interface EmailMessage {
    /** Recipient address(es). */
    to: string | string[];
    /** Subject line. */
    subject: string;
    /** Rendered HTML body. */
    html: string;
    /** Optional plain-text body (recommended — improves deliverability). */
    text?: string;
    /** Override the sender's default From address for this message. */
    from?: string;
}

/** Result of a successful send. `id` is the provider's message id when available. */
export interface EmailSendResult {
    id?: string;
}

/**
 * The mailer **port** — the seam consumers implement to swap the email provider.
 *
 * `@trailmix-cms/core` ships {@link ResendEmailSender} as the default implementation, but any
 * object satisfying this interface (nodemailer, SES, a test double, …) can be passed wherever an
 * `EmailSender` is accepted — including `@trailmix-cms/core`'s `emailSender` option.
 */
export interface EmailSender {
    send(message: EmailMessage): Promise<EmailSendResult | void>;
}
