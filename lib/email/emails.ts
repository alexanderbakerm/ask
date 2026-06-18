import { render } from "@react-email/render";
import { sendEmail } from "./resend";
import type { ConfirmEmailAddressChangeEmailProps } from "./templates/confirm-email-address-change-email";
import type { ContactFormEmailProps } from "./templates/contact-form-email";
import type { DisputeReceivedEmailProps } from "./templates/dispute-received-email";
import type { OrganizationInvitationEmailProps } from "./templates/organization-invitation-email";
import type { PasswordResetEmailProps } from "./templates/password-reset-email";
import type { PaymentFailedEmailProps } from "./templates/payment-failed-email";
import type { RevokedInvitationEmailProps } from "./templates/revoked-invitation-email";
import type { SubscriptionCanceledEmailProps } from "./templates/subscription-canceled-email";
import type { TrialEndingSoonEmailProps } from "./templates/trial-ending-soon-email";
import type { VerifyEmailAddressEmailProps } from "./templates/verify-email-address-email";

export async function sendOrganizationInvitationEmail(
	input: OrganizationInvitationEmailProps & { recipient: string },
): Promise<void> {
	const { OrganizationInvitationEmail } = await import(
		"./templates/organization-invitation-email"
	);
	const component = OrganizationInvitationEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: "Organization invitation",
		html,
		text,
	});
}

export async function sendVerifyEmailAddressEmail(
	input: VerifyEmailAddressEmailProps & { recipient: string },
): Promise<void> {
	const { VerifyEmailAddressEmail } = await import(
		"./templates/verify-email-address-email"
	);
	const component = VerifyEmailAddressEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: "Verify email address",
		html,
		text,
	});
}

export async function sendPasswordResetEmail(
	input: PasswordResetEmailProps & { recipient: string },
): Promise<void> {
	const { PasswordResetEmail } = await import(
		"./templates/password-reset-email"
	);
	const component = PasswordResetEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: "Reset password instructions",
		html,
		text,
	});
}

export async function sendConfirmEmailAddressChangeEmail(
	input: ConfirmEmailAddressChangeEmailProps & { recipient: string },
): Promise<void> {
	const { ConfirmEmailAddressChangeEmail } = await import(
		"./templates/confirm-email-address-change-email"
	);
	const component = ConfirmEmailAddressChangeEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: "Change email instructions",
		html,
		text,
	});
}

export async function sendRevokedInvitationEmail(
	input: RevokedInvitationEmailProps & { recipient: string },
): Promise<void> {
	const { RevokedInvitationEmail } = await import(
		"./templates/revoked-invitation-email"
	);
	const component = RevokedInvitationEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: "Invitation revoked",
		html,
		text,
	});
}

export async function sendPaymentFailedEmail(
	input: PaymentFailedEmailProps & { recipient: string },
): Promise<void> {
	const { PaymentFailedEmail } = await import(
		"./templates/payment-failed-email"
	);
	const component = PaymentFailedEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: `Payment failed for ${input.organizationName} - Action required`,
		html,
		text,
	});
}

export async function sendSubscriptionCanceledEmail(
	input: SubscriptionCanceledEmailProps & { recipient: string },
): Promise<void> {
	const { SubscriptionCanceledEmail } = await import(
		"./templates/subscription-canceled-email"
	);
	const component = SubscriptionCanceledEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: `Your ${input.planName} subscription has been canceled`,
		html,
		text,
	});
}

export async function sendTrialEndingSoonEmail(
	input: TrialEndingSoonEmailProps & { recipient: string },
): Promise<void> {
	const { TrialEndingSoonEmail } = await import(
		"./templates/trial-ending-soon-email"
	);
	const component = TrialEndingSoonEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	const daysText =
		input.daysRemaining === 1 ? "1 day" : `${input.daysRemaining} days`;
	await sendEmail({
		recipient: input.recipient,
		subject: `Your ${input.planName} trial ends in ${daysText}`,
		html,
		text,
	});
}

export async function sendContactFormEmail(
	input: ContactFormEmailProps & { recipient: string },
): Promise<void> {
	const { ContactFormEmail } = await import("./templates/contact-form-email");
	const component = ContactFormEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: `New contact form submission from ${input.firstName} ${input.lastName}`,
		html,
		text,
		replyTo: input.email,
	});
}

export async function sendDisputeReceivedEmail(
	input: DisputeReceivedEmailProps & { recipient: string },
): Promise<void> {
	const { DisputeReceivedEmail } = await import(
		"./templates/dispute-received-email"
	);
	const component = DisputeReceivedEmail(input);
	const html = await render(component);
	const text = await render(component, { plainText: true });

	await sendEmail({
		recipient: input.recipient,
		subject: `URGENT: Dispute Received for ${input.organizationName}`,
		html,
		text,
	});
}
