import { Resend } from 'resend';
import type { EmailSender, EmailMessage, EmailSendResult } from './sender.js';

/** Options for {@link ResendEmailSender}. Provide either an `apiKey` or a pre-built `client`. */
export interface ResendEmailSenderOptions {
    /** Resend API key. Used to construct a client when `client` is not supplied. */
    apiKey?: string;
    /** A pre-configured Resend client (use this to share one client or customize it). */
    client?: Resend;
    /** Default From address (e.g. `"Acme <noreply@acme.com>"`). Used when a message omits `from`. */
    from: string;
}

/**
 * The default {@link EmailSender} implementation, backed by [Resend](https://resend.com).
 *
 * Swap it by passing any other `EmailSender` wherever this is accepted.
 *
 * @example
 * ```ts
 * const sender = new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY, from: 'Acme <noreply@acme.com>' });
 * await sender.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' });
 * ```
 */
export class ResendEmailSender implements EmailSender {
    private readonly client: Resend;
    private readonly from: string;

    constructor(options: ResendEmailSenderOptions) {
        if (!options.client && !options.apiKey) {
            throw new Error('ResendEmailSender requires either an `apiKey` or a `client`.');
        }
        this.client = options.client ?? new Resend(options.apiKey);
        this.from = options.from;
    }

    async send(message: EmailMessage): Promise<EmailSendResult> {
        const { data, error } = await this.client.emails.send({
            from: message.from ?? this.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            ...(message.text ? { text: message.text } : {}),
        });

        if (error) {
            throw new Error(`Resend failed to send email: ${error.message}`);
        }

        return { id: data?.id };
    }
}
