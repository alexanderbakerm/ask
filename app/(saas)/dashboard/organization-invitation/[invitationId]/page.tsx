import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type * as React from "react";
import { OrganizationInvitationCard } from "@/components/invitations/organization-invitation-card";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";

export const metadata: Metadata = {
	title: "Organization Invitation",
};

export type OrganizationInvitationPageProps = {
	params: Promise<{ invitationId: string }>;
};

export default async function OrganizationInvitationPage({
	params,
}: OrganizationInvitationPageProps): Promise<React.JSX.Element> {
	const { invitationId } = await params;

	const [invitation, session] = await Promise.all([
		auth.api.getInvitation({
			query: {
				id: invitationId,
			},
			headers: await headers(),
		}),
		getSession(),
	]);

	// Redirect if invitation not found, not pending, or expired
	if (
		!invitation ||
		invitation.status !== "pending" ||
		new Date(invitation.expiresAt) < new Date()
	) {
		redirect("/dashboard");
	}

	// Check if logged-in user's email matches the invitation email
	const isRecipient =
		session?.user?.email?.toLowerCase() === invitation.email.toLowerCase();

	const organization = await db.query.organizationTable.findFirst({
		where: (org, { eq }) => eq(org.id, invitation.organizationId),
		with: {
			members: true,
			invitations: true,
		},
	});

	// Show error message if user is not the recipient
	if (!isRecipient) {
		return (
			<>
				<Card className="w-full border-transparent px-4 py-8 dark:border-border">
					<CardHeader>
						<CardTitle className="text-center text-base lg:text-lg">
							Wrong Account
						</CardTitle>
						<CardDescription className="text-center">
							This invitation was sent to{" "}
							<span className="font-medium">{invitation.email}</span>. Please
							sign in with that email address to accept this invitation.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col items-center gap-4">
						<p className="text-muted-foreground text-center text-sm">
							You are currently signed in as{" "}
							<span className="font-medium">{session?.user?.email}</span>.
						</p>
					</CardContent>
				</Card>
				<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
			</>
		);
	}

	return (
		<>
			<OrganizationInvitationCard
				invitationId={invitationId}
				logoUrl={organization?.logo || undefined}
				organizationName={invitation.organizationName}
			/>
			<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
		</>
	);
}
