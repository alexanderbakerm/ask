import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";
import { withQuery } from "ufo";
import { SignUpCard } from "@/components/auth/sign-up-card";
import { authConfig } from "@/config/auth.config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Create an account",
};

export type SignupPageProps = {
	searchParams: Promise<{
		[key: string]: string | string[] | undefined;
		invitationId?: string;
	}>;
};

export default async function SignupPage({
	searchParams,
}: SignupPageProps): Promise<React.JSX.Element> {
	const params = await searchParams;
	const { invitationId } = params;

	// Redirect to sign-in if signup is disabled and no invitation
	if (!(authConfig.enableSignup || invitationId)) {
		return redirect(withQuery("/auth/sign-in", params));
	}

	if (invitationId) {
		const invitation = await db.query.invitationTable.findFirst({
			where: (i, { eq }) => eq(i.id, invitationId),
			with: {
				organization: true,
			},
		});

		if (
			!invitation ||
			invitation.status !== "pending" ||
			invitation.expiresAt.getTime() < Date.now()
		) {
			return redirect(withQuery("/auth/sign-in", params));
		}

		return <SignUpCard prefillEmail={invitation.email} />;
	}

	return <SignUpCard />;
}
