import * as React from 'react';
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';

/** Branding shared across the built-in templates. Override per-template via props. */
export interface EmailBranding {
    /** Product name shown in the footer / greetings. Defaults to `"Trailmix CMS"`. */
    productName?: string;
    /** Accent color for buttons and links. Defaults to `"#2563eb"`. */
    accentColor?: string;
}

export interface EmailLayoutProps extends EmailBranding {
    /** Inbox preview text (hidden in the body). */
    preview: string;
    /** Heading rendered at the top of the card. */
    heading: string;
    children: React.ReactNode;
}

const main: React.CSSProperties = {
    backgroundColor: '#f4f4f5',
    fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: '24px 0',
};

const container: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    margin: '0 auto',
    maxWidth: '480px',
    padding: '32px',
};

const headingStyle: React.CSSProperties = {
    color: '#18181b',
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 16px',
};

const footerStyle: React.CSSProperties = {
    color: '#a1a1aa',
    fontSize: '12px',
    lineHeight: '18px',
    margin: '24px 0 0',
};

/** Shared shell for the built-in auth emails: preview, card, heading, slot, footer. */
export function EmailLayout({
    preview,
    heading,
    children,
    productName = 'Trailmix CMS',
}: EmailLayoutProps) {
    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Heading style={headingStyle}>{heading}</Heading>
                    {children}
                    <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0 0' }} />
                    <Text style={footerStyle}>
                        Sent by {productName}. If you weren’t expecting this email, you can safely
                        ignore it.
                    </Text>
                </Container>
            </Body>
        </Html>
    );
}

const paragraph: React.CSSProperties = {
    color: '#3f3f46',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
};

/** A standard body paragraph for use inside {@link EmailLayout}. */
export function Paragraph({ children }: { children: React.ReactNode }) {
    return <Text style={paragraph}>{children}</Text>;
}

/** A primary call-to-action button + a copy-paste fallback link. */
export function ActionButton({
    url,
    label,
    accentColor = '#2563eb',
}: {
    url: string;
    label: string;
    accentColor?: string;
}) {
    return (
        <Section style={{ margin: '8px 0 24px' }}>
            <Button
                href={url}
                style={{
                    backgroundColor: accentColor,
                    borderRadius: '6px',
                    color: '#ffffff',
                    display: 'inline-block',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '12px 20px',
                    textDecoration: 'none',
                }}
            >
                {label}
            </Button>
            <Text style={{ ...paragraph, color: '#71717a', fontSize: '13px', margin: '16px 0 0' }}>
                Or paste this link into your browser:
                <br />
                <Link href={url} style={{ color: accentColor, wordBreak: 'break-all' }}>
                    {url}
                </Link>
            </Text>
        </Section>
    );
}
