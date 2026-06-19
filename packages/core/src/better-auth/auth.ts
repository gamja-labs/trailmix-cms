import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from 'better-auth';
import { admin, openAPI, organization } from 'better-auth/plugins';
import {
    type EmailSender,
    type EmailBranding,
    type RenderedEmail,
    type VerifyEmailProps,
    type ResetPasswordProps,
    type OrganizationInvitationProps,
    renderResetPassword,
    renderVerifyEmail,
    renderOrganizationInvitation,
} from '../email/index.js';

type OrganizationOptions = NonNullable<Parameters<typeof organization>[0]>;
type AdminOptions = Parameters<typeof admin>[0];
type OpenAPIOptions = Parameters<typeof openAPI>[0];

export interface TrailmixPluginsOptions {
    /** Enable the better-auth organization plugin. `true` uses defaults; pass an object to configure it. */
    organization?: boolean | OrganizationOptions;
    /** Enable the better-auth admin plugin. `true` uses defaults; pass an object to configure it. */
    admin?: boolean | AdminOptions;
    /** Enable the better-auth OpenAPI plugin (Scalar reference at `/api/auth/reference`). */
    openAPI?: boolean | OpenAPIOptions;
}

/**
 * Build the better-auth plugin array for the Trailmix-supported plugins
 * (organization, admin, OpenAPI), in a stable order.
 *
 * Compose with your own plugins when calling `betterAuth`:
 * ```ts
 * betterAuth({ ...rest, plugins: [...trailmixPlugins({ admin: true }), myPlugin()] });
 * ```
 */
export function trailmixPlugins(options: TrailmixPluginsOptions = {}): BetterAuthPlugin[] {
    const plugins: BetterAuthPlugin[] = [];
    if (options.organization) {
        plugins.push(organization(typeof options.organization === 'object' ? options.organization : undefined));
    }
    if (options.admin) {
        plugins.push(admin(typeof options.admin === 'object' ? options.admin : undefined));
    }
    if (options.openAPI) {
        plugins.push(openAPI(typeof options.openAPI === 'object' ? options.openAPI : undefined));
    }
    return plugins;
}

/**
 * The better-auth database adapter — e.g. the result of better-auth's `mongodbAdapter(...)`.
 * `setupTrailmixAuth` builds this from the connection `@trailmix-cms/core` opens and hands it to
 * your `createAuth`.
 */
export type TrailmixAuthDatabase = NonNullable<BetterAuthOptions['database']>;

/**
 * A template renderer: given the same props the built-in template takes, return the
 * `{ subject, html, text }` to send. Use the exported `renderEmail(element)` helper to render
 * your own react-email component, or return plain strings.
 */
export type EmailTemplateRenderer<Props> = (props: Props) => RenderedEmail | Promise<RenderedEmail>;

/**
 * Per-flow template overrides. Provide a renderer to replace a built-in template entirely while
 * keeping the auto-wiring (sender dispatch, recipient/URL plumbing, and the "your own better-auth
 * callback still wins" precedence). Each renderer receives the same props as the built-in template.
 */
export interface TrailmixEmailTemplates {
    /** Replace the email-verification template. */
    verifyEmail?: EmailTemplateRenderer<VerifyEmailProps>;
    /** Replace the password-reset template. */
    resetPassword?: EmailTemplateRenderer<ResetPasswordProps>;
    /** Replace the organization-invitation template. */
    organizationInvitation?: EmailTemplateRenderer<OrganizationInvitationProps>;
}

/** Options controlling how the built-in email templates are wired, branded, and overridden. */
export interface TrailmixEmailOptions {
    /** Branding (product name, accent color) forwarded to the built-in templates. */
    branding?: EmailBranding;
    /**
     * Override individual templates with your own renderers. Anything not overridden falls back to
     * the built-in react-email template (with {@link branding} applied).
     */
    templates?: TrailmixEmailTemplates;
    /**
     * Build the accept-invitation URL for the organization plugin from its invitation data.
     * Defaults to `${baseURL}/accept-invitation/${id}` (using the `baseURL` you pass to better-auth).
     */
    organizationInvitationUrl?: (invitation: { id: string }) => string;
}

export interface CreateTrailmixAuthConfigOptions extends Omit<BetterAuthOptions, 'database' | 'plugins'>, TrailmixPluginsOptions {
    /** The better-auth database adapter (e.g. `mongodbAdapter(db, { client })`). */
    database: TrailmixAuthDatabase;
    /** Additional better-auth plugins to register alongside the Trailmix-managed ones. */
    plugins?: BetterAuthPlugin[];
    /**
     * An {@link EmailSender} (e.g. `ResendEmailSender`). When provided, the Trailmix templates are
     * wired into better-auth's `sendResetPassword`, `sendVerificationEmail`, and the organization
     * plugin's `sendInvitationEmail` — unless you've supplied those callbacks yourself. Bring your
     * own mailer by passing any object that satisfies `EmailSender`.
     */
    emailSender?: EmailSender;
    /**
     * Tweaks for the built-in email flow: {@link TrailmixEmailOptions.branding branding},
     * per-template {@link TrailmixEmailOptions.templates overrides}, and the invitation URL.
     */
    email?: TrailmixEmailOptions;
}

type EmailAndPasswordOptions = NonNullable<BetterAuthOptions['emailAndPassword']>;
type SendResetPassword = NonNullable<EmailAndPasswordOptions['sendResetPassword']>;
type EmailVerificationOptions = NonNullable<BetterAuthOptions['emailVerification']>;
type SendVerificationEmail = NonNullable<EmailVerificationOptions['sendVerificationEmail']>;
type SendInvitationEmail = NonNullable<OrganizationOptions['sendInvitationEmail']>;

function makeSendResetPassword(sender: EmailSender, email?: TrailmixEmailOptions): SendResetPassword {
    const render = email?.templates?.resetPassword ?? renderResetPassword;
    return async ({ user, url }) => {
        const rendered = await render({ url, user, ...email?.branding });
        await sender.send({ to: user.email, ...rendered });
    };
}

function makeSendVerificationEmail(sender: EmailSender, email?: TrailmixEmailOptions): SendVerificationEmail {
    const render = email?.templates?.verifyEmail ?? renderVerifyEmail;
    return async ({ user, url }) => {
        const rendered = await render({ url, user, ...email?.branding });
        await sender.send({ to: user.email, ...rendered });
    };
}

function makeSendInvitationEmail(
    sender: EmailSender,
    baseURL: string | undefined,
    email?: TrailmixEmailOptions,
): SendInvitationEmail {
    const render = email?.templates?.organizationInvitation ?? renderOrganizationInvitation;
    return async (data) => {
        const url = email?.organizationInvitationUrl?.(data)
            ?? `${baseURL ?? ''}/accept-invitation/${data.id}`;
        const rendered = await render({
            url,
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name || data.inviter.user.email,
            role: data.role,
            ...email?.branding,
        });
        await sender.send({ to: data.email, ...rendered });
    };
}

/** Merge the built-in invitation email into the organization plugin options when an `emailSender` is set. */
function withInvitationEmail(
    organizationOption: boolean | OrganizationOptions | undefined,
    sender: EmailSender | undefined,
    baseURL: string | undefined,
    email: TrailmixEmailOptions | undefined,
): boolean | OrganizationOptions | undefined {
    if (!sender || !organizationOption) return organizationOption;
    const base: OrganizationOptions = typeof organizationOption === 'object' ? organizationOption : {};
    if (base.sendInvitationEmail) return base;
    return { ...base, sendInvitationEmail: makeSendInvitationEmail(sender, baseURL, email) };
}

/**
 * Builds a better-auth **configuration object** preconfigured for Trailmix: the MongoDB
 * adapter, sensible defaults, the opted-in organization / admin / OpenAPI plugins, and — when an
 * `emailSender` is provided — the built-in verification / reset / invitation email templates.
 *
 * This intentionally returns config rather than an instance — you own instance creation,
 * so you can wrap it, add hooks, or swap pieces before calling `betterAuth`:
 *
 * @example
 * ```ts
 * import { betterAuth } from 'better-auth';
 * import { mongodbAdapter } from 'better-auth/adapters/mongodb';
 * import { createTrailmixAuthConfig } from '@trailmix-cms/core';
 *
 * export const auth = betterAuth(createTrailmixAuthConfig({
 *   database: mongodbAdapter(db, { client }),
 *   emailSender,            // ResendEmailSender — wires verification / reset / invite emails
 *   organization: true,
 *   admin: true,
 *   openAPI: true,
 * }));
 * ```
 */
export function createTrailmixAuthConfig(options: CreateTrailmixAuthConfigOptions): BetterAuthOptions {
    const {
        database,
        organization: organizationOption,
        admin: adminOption,
        openAPI: openAPIOption,
        plugins = [],
        emailSender,
        email,
        ...rest
    } = options;

    // Merge email callbacks in without clobbering any the caller provided themselves.
    const emailAndPassword: EmailAndPasswordOptions = {
        enabled: true,
        ...rest.emailAndPassword,
        ...(emailSender && !rest.emailAndPassword?.sendResetPassword
            ? { sendResetPassword: makeSendResetPassword(emailSender, email) }
            : {}),
    };

    const verification = rest.emailVerification;
    const emailVerification: EmailVerificationOptions | undefined =
        emailSender || verification
            ? {
                  ...verification,
                  ...(emailSender && !verification?.sendVerificationEmail
                      ? { sendVerificationEmail: makeSendVerificationEmail(emailSender, email) }
                      : {}),
              }
            : undefined;

    return {
        ...rest,
        emailAndPassword,
        ...(emailVerification ? { emailVerification } : {}),
        database,
        plugins: [
            ...trailmixPlugins({
                // better-auth's `baseURL` may be a dynamic config rather than a string; the built-in
                // invitation URL builder only uses it when it's a plain string.
                organization: withInvitationEmail(
                    organizationOption,
                    emailSender,
                    typeof rest.baseURL === 'string' ? rest.baseURL : undefined,
                    email,
                ),
                admin: adminOption,
                openAPI: openAPIOption,
            }),
            ...(plugins ?? []),
        ],
    };
}

/**
 * The Trailmix better-auth config minus the `database` — `setupTrailmixAuth` supplies the adapter
 * it built. This is what {@link createTrailmixAuth} accepts as its second argument.
 */
export type TrailmixAuthConfig = Omit<CreateTrailmixAuthConfigOptions, 'database'>;

/**
 * Builds the better-auth **instance** from the database adapter `setupTrailmixAuth` hands your
 * `createAuth` plus your {@link TrailmixAuthConfig}. Call it inside `createAuth` for the Trailmix
 * defaults (organization/admin/OpenAPI plugins + optional email templates) without spelling them out.
 *
 * @example
 * ```ts
 * setupTrailmixAuth({
 *   connectionModule: core.connectionModule,
 *   createAuth: (database) => createTrailmixAuth(database, {
 *     baseURL: config.BETTER_AUTH_URL,
 *     secret: config.BETTER_AUTH_SECRET,
 *     emailSender,
 *     admin: true,
 *     organization: true,
 *     openAPI: true,
 *   }),
 * });
 * ```
 */
export function createTrailmixAuth(database: TrailmixAuthDatabase, config: TrailmixAuthConfig) {
    return betterAuth(createTrailmixAuthConfig({ ...config, database }));
}
