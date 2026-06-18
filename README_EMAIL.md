# Email System

This template uses **React Email** for beautiful email templates and **Resend** for reliable email delivery. It includes pre-built templates for authentication, billing and team invitations.

---

## Quick Setup

### 1. Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain (Domains → Add Domain)
3. Create an API key (API Keys → Create API Key)

### 2. Configure Environment Variables

```bash
# .env
EMAIL_FROM="noreply@yourdomain.com"
RESEND_API_KEY="re_xxxxx"
```

Contact email is configured in `config/app.config.ts` (see `appConfig.contact.email`).

That's it! Emails are now enabled.

---

## Development

### Preview Email Templates

```bash
npm run email:dev
```

Opens React Email preview at [http://localhost:3001](http://localhost:3001). You can view and test all templates with sample data.

### Test Emails (Development)

During development without Resend configured:
- Auth verification links are logged to the console
- Check terminal output for verification URLs

For testing with Resend's free tier:
- Use `EMAIL_FROM="onboarding@resend.dev"` (only sends to your account email)

---

## Available Templates

### Authentication

| Template | Trigger | Description |
|----------|---------|-------------|
| **Verify Email** | User signup | Email verification link |
| **Password Reset** | Forgot password | Reset password instructions |
| **Confirm Email Change** | User changes email | Verify new email address |

### Organizations

| Template | Trigger | Description |
|----------|---------|-------------|
| **Organization Invitation** | Member invited | Join team invitation |
| **Revoked Invitation** | Invitation cancelled | Notification of cancellation |

### Billing

| Template | Trigger | Description |
|----------|---------|-------------|
| **Payment Failed** | Stripe webhook | Payment failure notification |
| **Subscription Canceled** | Stripe webhook | Cancellation confirmation |
| **Trial Ending Soon** | Stripe webhook | Trial expiration warning (3 days) |

### Marketing

| Template | Trigger | Description |
|----------|---------|-------------|
| **Contact Form** | Form submission | Contact form notification |
| **Welcome** | User signup | Welcome message (available but not wired) |

---

## Sending Emails

### Using the Email Service

```typescript
import {
  sendPasswordResetEmail,
  sendOrganizationInvitationEmail,
} from "@/lib/email";

// Send a password reset email
await sendPasswordResetEmail({
  recipient: "user@example.com",
  appName: "My App",
  name: "John Doe",
  resetPasswordLink: "https://myapp.com/reset?token=xxx",
});

// Send an organization invitation
await sendOrganizationInvitationEmail({
  recipient: "newmember@example.com",
  appName: "My App",
  organizationName: "Acme Inc",
  invitedByName: "Jane Smith",
  invitedByEmail: "jane@acme.com",
  inviteLink: "https://myapp.com/auth/sign-up?invitationId=xxx",
});
```

### Available Functions

```typescript
// Authentication
sendVerifyEmailAddressEmail({ recipient, name, verificationLink })
sendPasswordResetEmail({ recipient, appName, name, resetPasswordLink })
sendConfirmEmailAddressChangeEmail({ recipient, name, confirmLink })

// Organizations
sendOrganizationInvitationEmail({ recipient, appName, organizationName, invitedByName, invitedByEmail, inviteLink })
sendRevokedInvitationEmail({ recipient, appName, organizationName })

// Billing
sendPaymentFailedEmail({ recipient, appName, organizationName, userName, amount, currency, updatePaymentLink, invoiceId? })
sendSubscriptionCanceledEmail({ recipient, appName, organizationName, userName, planName, cancelDate, accessEndDate })
sendTrialEndingSoonEmail({ recipient, appName, organizationName, userName, planName, trialEndDate, daysRemaining, billingSettingsLink })

// Marketing
sendContactFormEmail({ recipient, appName, firstName, lastName, email, message })
```

---

## Creating a New Template

### Step 1: Create the Template File

Create `lib/email/templates/my-new-email.tsx`:

```tsx
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
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

// 1. Define props type (export it)
export type MyNewEmailProps = {
  userName: string;
  actionLink: string;
};

// 2. Create the component
function MyNewEmail({
  userName,
  actionLink,
}: MyNewEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Your preview text for email clients</Preview>
      <Tailwind>
        <Body className="m-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              Email Title
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {userName},
            </Text>
            <Text className="text-[14px] text-black leading-[24px]">
              Your email content goes here.
            </Text>
            <Section className="my-[32px] text-center">
              <Button
                href={actionLink}
                className="rounded-sm bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
              >
                Take Action
              </Button>
            </Section>
            <Text className="text-[14px] text-black leading-[24px]">
              or copy and paste this URL into your browser:{" "}
              <Link
                href={actionLink}
                className="break-all text-blue-600 no-underline"
              >
                {actionLink}
              </Link>
            </Text>
            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              If you didn't request this email, you can safely ignore it.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// 3. Add preview props for development
MyNewEmail.PreviewProps = {
  userName: "John Doe",
  actionLink: "https://example.com/action",
} satisfies MyNewEmailProps;

// 4. Export the component
export default MyNewEmail;
export { MyNewEmail };
```

### Step 2: Add Email Function

In `lib/email/emails.ts`:

```typescript
// Add import at top
import type { MyNewEmailProps } from "./templates/my-new-email";
import { sendEmail } from "./resend";
import { render } from "@react-email/render";

// Add function export
export async function sendMyNewEmail(
  input: MyNewEmailProps & { recipient: string }
): Promise<void> {
  const { MyNewEmail } = await import("./templates/my-new-email");
  const component = MyNewEmail(input);
  const html = await render(component);
  const text = await render(component, { plainText: true });

  await sendEmail({
    recipient: input.recipient,
    subject: "Your email subject",
    html,
    text,
  });
}
```

### Step 3: Use the Template

```typescript
import { sendMyNewEmail } from "@/lib/email";

await sendMyNewEmail({
  recipient: "user@example.com",
  userName: "John Doe",
  actionLink: "https://myapp.com/action",
});
```

---

## Template Components

React Email provides these components:

| Component | Purpose |
|-----------|---------|
| `Html` | Root wrapper |
| `Head` | Email head (meta tags) |
| `Preview` | Preview text in email clients |
| `Body` | Email body |
| `Container` | Centered content container |
| `Section` | Content section |
| `Heading` | h1-h6 headings |
| `Text` | Paragraphs |
| `Button` | Call-to-action buttons |
| `Link` | Hyperlinks |
| `Hr` | Horizontal rule |
| `Img` | Images |
| `Tailwind` | Tailwind CSS support |

See [React Email docs](https://react.email/docs/components/html) for full documentation.

---

## Error Handling & Retries

The email service includes automatic retry logic:

### Retry Configuration

```typescript
{
  maxAttempts: 3,
  baseDelayMs: 1000,  // Exponential backoff: 1s, 2s, 4s
  maxDelayMs: 10000,
}
```

### Permanent Errors (No Retry)

These errors won't be retried:
- Invalid email address
- Unauthorized (API key issues)
- Recipient unsubscribed
- Email blocked/bounced
- Spam complaints

### Transient Errors (Will Retry)

These errors trigger retries:
- Network timeouts
- Rate limits
- Server errors (5xx)

---

## Security

### Header Injection Protection

The service sanitizes `replyTo` headers to prevent injection attacks:

```typescript
// Removes control characters (\r, \n, \t, \0)
const sanitizedReplyTo = sanitizeEmailHeader(payload.replyTo);
```

### Environment Validation

Email configuration is validated at startup via `lib/env.ts`. Missing required variables will cause a build error.

---

## Resend Free Tier

Resend offers a generous free tier:
- **3,000 emails/month**
- **100 emails/day**
- Single sending domain

For production, consider upgrading for higher limits and additional features.

---

## Troubleshooting

### Emails Not Sending

1. **Check API key**: Verify `RESEND_API_KEY` is set correctly
2. **Check domain**: Ensure domain is verified in Resend dashboard
3. **Check EMAIL_FROM**: Must match a verified domain

### Emails Going to Spam

1. **Verify domain**: Complete DNS verification (SPF, DKIM, DMARC)
2. **Use professional FROM address**: `noreply@yourdomain.com`
3. **Avoid spam triggers**: Don't use ALL CAPS, excessive exclamation marks

### Template Not Rendering

1. **Check props**: Ensure all required props are passed
2. **Run preview**: `npm run email:dev` to test templates
3. **Check imports**: Verify component exports

### Development Mode

Without Resend configured:
- Better Auth logs verification links to console
- Check terminal for URLs during signup/password reset

---

## File Reference

| File                        | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `lib/email/index.ts`        | Service export                                         |
| `lib/email/resend.ts`       | Resend provider (client setup, retry logic, sendEmail) |
| `lib/email/emails.ts`       | Email template functions (uses sendEmail from resend)  |
| `lib/email/templates/*.tsx` | Email templates                                        |

### Template Files

| File | Email Type |
|------|------------|
| `welcome-email.tsx` | Welcome message |
| `verify-email-address-email.tsx` | Email verification |
| `password-reset-email.tsx` | Password reset |
| `confirm-email-address-change-email.tsx` | Email change |
| `organization-invitation-email.tsx` | Team invitation |
| `revoked-invitation-email.tsx` | Invitation revoked |
| `contact-form-email.tsx` | Contact form |
| `payment-failed-email.tsx` | Payment failure |
| `subscription-canceled-email.tsx` | Subscription canceled |
| `trial-ending-soon-email.tsx` | Trial ending |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_FROM` | Yes | Sender email address |
| `RESEND_API_KEY` | Yes | Resend API key |

> **Note**: Contact email (for contact form recipient) is configured in `config/app.config.ts`
