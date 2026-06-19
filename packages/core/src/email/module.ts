import { DynamicModule, Inject, Injectable, Module, Provider } from '@nestjs/common';
import type { EmailMessage, EmailSender } from './sender.js';
import { ResendEmailSender } from './resend.sender.js';

/** DI token holding the configured {@link EmailSender}. */
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/**
 * Options for {@link EmailModule.forRoot}.
 *
 * Provide a ready-made `sender` (any {@link EmailSender}) to bring your own mailer, or pass
 * `apiKey` + `from` to use the built-in {@link ResendEmailSender}.
 */
export interface EmailModuleOptions {
    /** A custom {@link EmailSender}. Takes precedence over `apiKey`/`from`. */
    sender?: EmailSender;
    /** Resend API key — used to build a {@link ResendEmailSender} when `sender` is omitted. */
    apiKey?: string;
    /** Default From address for the built-in Resend sender. */
    from?: string;
}

/** Thin injectable wrapper over the configured {@link EmailSender}. */
@Injectable()
export class EmailService {
    constructor(@Inject(EMAIL_SENDER) private readonly sender: EmailSender) {}

    /** Deliver a message through the configured sender. */
    send(message: EmailMessage) {
        return this.sender.send(message);
    }
}

/**
 * Optional global Nest module exposing an {@link EmailSender} (via {@link EMAIL_SENDER}) and
 * {@link EmailService} for injection.
 *
 * Not required for the `@trailmix-cms/core` email flows (which take an `EmailSender`
 * instance directly) — use it when your own providers/hooks want to send mail through DI.
 *
 * @example
 * ```ts
 * @Module({ imports: [EmailModule.forRoot({ apiKey: process.env.RESEND_API_KEY, from: 'Acme <no-reply@acme.com>' })] })
 * export class AppModule {}
 * ```
 */
@Module({})
export class EmailModule {
    static forRoot(options: EmailModuleOptions): DynamicModule {
        const provider: Provider = {
            provide: EMAIL_SENDER,
            useValue: resolveSender(options),
        };
        return {
            module: EmailModule,
            global: true,
            providers: [provider, EmailService],
            exports: [EMAIL_SENDER, EmailService],
        };
    }
}

function resolveSender(options: EmailModuleOptions): EmailSender {
    if (options.sender) return options.sender;
    if (!options.apiKey || !options.from) {
        throw new Error('EmailModule.forRoot requires either `sender`, or both `apiKey` and `from`.');
    }
    return new ResendEmailSender({ apiKey: options.apiKey, from: options.from });
}
