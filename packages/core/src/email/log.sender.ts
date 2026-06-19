import type { EmailSender, EmailMessage, EmailSendResult } from './sender.js';

/** A `console`-like sink. The default is `console`; pass a Nest `Logger` to route through it. */
export interface LogSink {
    log(message: string): void;
}

/**
 * A no-network {@link EmailSender} that logs messages instead of sending them.
 *
 * Useful in development / tests, or as a fallback when no provider API key is configured —
 * the email flows stay wired and visible without delivering real mail.
 */
export class LogEmailSender implements EmailSender {
    constructor(private readonly sink: LogSink = console) {}

    async send(message: EmailMessage): Promise<EmailSendResult> {
        const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
        this.sink.log(`[LogEmailSender] To: ${to} | Subject: ${message.subject}`);
        return {};
    }
}
