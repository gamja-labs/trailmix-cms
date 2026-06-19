# Email

The transactional-email layer of [`@trailmix-cms/core`](./core.md), at the
`@trailmix-cms/core/email` subpath, bundles three replaceable pieces:

- **`EmailSender`** — a tiny mailer **port** (the seam you implement to swap providers).
- **`ResendEmailSender`** — the default implementation, backed by [Resend](https://resend.com).
- **react-email templates** — branded templates for the [auth](./better-auth.md) flows (verification,
  password reset, magic link, organization invitation).

Email is **optional** — its dependencies are optional peers, pulled in only if you use this subpath:

```bash
yarn add resend @react-email/components @react-email/render react react-dom
```

Pass an `EmailSender` to `createTrailmixAuth` and the auth emails wire themselves up; use the pieces
directly for your own transactional mail.

Set the provider env (the example app falls back to a logging sender when `RESEND_API_KEY` is unset):

```bash
RESEND_API_KEY=...
EMAIL_FROM="Acme <no-reply@acme.com>"
```

## The `EmailSender` port

Everything that sends mail does so through this interface — implement it to use any provider:

```typescript
interface EmailMessage {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
}

interface EmailSender {
    send(message: EmailMessage): Promise<{ id?: string } | void>;
}
```

The package ships two implementations:

```typescript
import { ResendEmailSender, LogEmailSender } from '@trailmix-cms/core/email';

// Default: Resend.
const sender = new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY!, from: 'Acme <no-reply@acme.com>' });

// Dev/test fallback: logs instead of sending (keeps flows wired without delivering mail).
const dev = new LogEmailSender();
```

Bring your own provider (nodemailer, SES, …) by implementing `EmailSender` and passing it wherever a
sender is accepted.

## Templates

The built-in react-email templates render to `{ subject, html, text }`:

```typescript
import { renderVerifyEmail, renderResetPassword, renderMagicLink, renderOrganizationInvitation } from '@trailmix-cms/core/email';

const { subject, html, text } = await renderResetPassword({
    url: 'https://acme.com/reset?token=…',
    user: { name: 'Ada', email: 'ada@acme.com' },
    productName: 'Acme',         // branding
    accentColor: '#7c3aed',
});

await sender.send({ to: 'ada@acme.com', subject, html, text });
```

Each render helper has a matching React component (`VerifyEmail`, `ResetPassword`, `MagicLink`,
`OrganizationInvitation`) and a shared `EmailLayout` you can compose or replace with your own.

## With better-auth

You usually don't render these by hand — pass an `EmailSender` to `createTrailmixAuth` and the
templates are wired into better-auth's verification / reset / invitation callbacks automatically:

```typescript
import { ResendEmailSender } from '@trailmix-cms/core/email';

createTrailmixAuth(database, {
    secret, baseURL,
    emailSender: new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY!, from: 'Acme <no-reply@acme.com>' }),
    organization: true,
    admin: true,
});
```

### Replacing a template

Override any single template while keeping the wiring (sender dispatch, recipient/URL plumbing) via
`email.templates`. A renderer receives the same props as the built-in and returns
`{ subject, html, text }` — use the exported `renderEmail()` helper for your own react-email
component, or return plain strings. Anything you don't override keeps the built-in template.

```tsx
import { ResendEmailSender, renderEmail } from '@trailmix-cms/core/email';
import { MyResetEmail } from './emails/reset';

createTrailmixAuth(database, {
    secret, baseURL,
    emailSender: new ResendEmailSender({ apiKey: process.env.RESEND_API_KEY!, from: 'Acme <no-reply@acme.com>' }),
    email: {
        templates: {
            // your own react-email component…
            resetPassword: async ({ url, user }) => ({
                subject: 'Reset your Acme password',
                ...(await renderEmail(<MyResetEmail url={url} name={user?.name} />)),
            }),
            // …or plain strings
            verifyEmail: ({ url }) => ({ subject: 'Confirm your email', html: `<a href="${url}">Verify</a>` }),
        },
    },
    organization: true,
    admin: true,
});
```

To replace the templates wholesale, supply your own better-auth `sendResetPassword` /
`sendVerificationEmail` callbacks directly — those take precedence over the wiring entirely. See
[Auth → Email integration](./better-auth.md#email-integration) for branding and the invitation URL.

## Sending from your own code (`EmailModule`)

To send mail from your providers/hooks via DI, register the optional global `EmailModule` and inject
`EmailService`:

```typescript
import { EmailModule, EmailService } from '@trailmix-cms/core/email';

@Module({ imports: [EmailModule.forRoot({ apiKey: process.env.RESEND_API_KEY, from: 'Acme <no-reply@acme.com>' })] })
export class AppModule {}

@Injectable()
export class WelcomeService {
    constructor(private readonly email: EmailService) {}
    notify(to: string) {
        return this.email.send({ to, subject: 'Welcome', html: '<p>Hi!</p>' });
    }
}
```

`EmailModule.forRoot` also accepts `{ sender }` to reuse an `EmailSender` instance (e.g. the same one
you pass to `createTrailmixAuth`).

## Next Steps

- Wire it into [authentication](./better-auth.md)
- Review the [Core](./core.md) foundation
