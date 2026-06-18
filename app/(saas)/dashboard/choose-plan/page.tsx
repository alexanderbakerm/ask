import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanSelection } from "@/components/billing/plan-selection";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { appConfig } from "@/config/app.config";
import { billingConfig } from "@/config/billing.config";
import { getOrganizationList, getSession } from "@/lib/auth/server";
import { getFreePlan } from "@/lib/billing/plans";
import { getActivePlanForOrganization } from "@/lib/billing/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Choose your plan",
	description: "Select a subscription plan to get started",
};

/**
 * Plan selection page displayed when billing is enabled without a free tier.
 * Users must select a paid plan before accessing organization features.
 *
 * Redirects to dashboard if:
 * - Billing is disabled
 * - A free plan exists
 * - User already has an active plan
 * - No organization exists or is selected
 */
export default async function ChoosePlanPage() {
	// Billing disabled - no plan selection needed
	if (!billingConfig.enabled) {
		redirect("/dashboard");
	}

	// If there's a free plan, users don't need to choose - redirect to dashboard
	const hasFreePlan = getFreePlan() !== undefined;
	if (hasFreePlan) {
		redirect("/dashboard");
	}

	const session = await getSession();

	// If no session, redirect to sign in with return URL
	if (!session) {
		redirect("/auth/sign-in?redirectTo=/dashboard/choose-plan");
	}

	// Get user's organizations
	let organizations: Awaited<ReturnType<typeof getOrganizationList>>;
	try {
		organizations = await getOrganizationList();
	} catch (error) {
		console.error("Failed to fetch organizations:", error);
		redirect("/dashboard?error=org-fetch-failed");
	}

	// If no organization exists, redirect to dashboard to create one first
	if (organizations.length === 0) {
		redirect("/dashboard?reason=no-organization");
	}

	// Require an active organization in the session
	// If user has organizations but none is active, redirect to dashboard to select one
	if (!session.session.activeOrganizationId) {
		redirect("/dashboard?reason=select-organization");
	}

	// Verify the active organization exists in user's org list
	const organization = organizations.find(
		(org) => org.id === session.session.activeOrganizationId,
	);

	if (!organization) {
		// Active organization doesn't exist anymore, redirect to dashboard
		redirect("/dashboard?reason=invalid-organization");
	}

	// Check if organization already has an active plan
	let activePlan: Awaited<ReturnType<typeof getActivePlanForOrganization>>;
	try {
		activePlan = await getActivePlanForOrganization(organization.id);
	} catch {
		// If billing check fails, let them through - better UX than blocking
		// The checkout will fail if there's actually a problem
		activePlan = null;
	}

	if (activePlan) {
		// Already has a plan, redirect to dashboard
		redirect("/dashboard/organization");
	}

	return (
		<main className="min-h-screen bg-neutral-50 px-4 dark:bg-background">
			<div className="mx-auto w-full max-w-5xl py-12">
				<Link className="mx-auto mb-6 block w-fit" href="/">
					<Logo />
				</Link>

				<div className="mb-8 flex flex-col items-center text-center">
					<h1 className="font-bold text-2xl lg:text-3xl">Choose your plan</h1>
					<p className="mt-2 text-muted-foreground text-sm lg:text-base">
						Select a plan to get started with {appConfig.appName}
					</p>
				</div>

				<PlanSelection />
			</div>
			<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
		</main>
	);
}
