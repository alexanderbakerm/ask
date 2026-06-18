import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Set up your account",
};

export default async function OnboardingPage(): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session) {
		return redirect("/auth/sign-in");
	}

	if (session.user.onboardingComplete) {
		return redirect("/dashboard");
	}

	return <OnboardingCard />;
}
