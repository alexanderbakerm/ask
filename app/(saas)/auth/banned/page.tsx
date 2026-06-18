import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type * as React from "react";
import { BannedCard } from "@/components/auth/banned-card";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
	title: "Account Suspended",
};

export default async function BannedPage(): Promise<React.JSX.Element> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session?.user.banned) {
		redirect("/dashboard");
	}

	return (
		<BannedCard
			banReason={session.user.banReason}
			banExpires={session.user.banExpires}
		/>
	);
}
