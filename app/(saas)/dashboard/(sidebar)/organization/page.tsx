import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";
import { Suspense } from "react";
import {
	AutoDashboard,
	DashboardSkeleton,
} from "@/components/dashboard/auto-dashboard";
import { DashboardDemo } from "@/components/dashboard/dashboard-demo";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
	PageTitle,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { dataSourceTable } from "@/lib/db/schema";
import { DataSourceStatus } from "@/lib/db/schema/enums";

export const metadata: Metadata = {
	title: "Dashboard",
};

/**
 * Organization dashboard page.
 * The active organization is obtained from the session by the layout,
 * and TRPC procedures use protectedOrganizationProcedure which validates it.
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session?.session.activeOrganizationId) {
		redirect("/dashboard");
	}

	const organization = await getOrganizationById(
		session.session.activeOrganizationId,
	);
	if (!organization) {
		redirect("/dashboard");
	}

	// Data-hub mode: if the org has a connected data source, the dashboard becomes
	// an auto-generated set of charts for it. With no source, it stays as-is.
	const sources = await db.query.dataSourceTable.findMany({
		where: eq(dataSourceTable.organizationId, organization.id),
	});
	const primarySource =
		sources.find((s) => s.status === DataSourceStatus.connected) ?? null;

	// Friendly greeting using the signed-in user's first name.
	const firstName = session.user.name?.trim().split(/\s+/)[0] || "there";

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Dashboard" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<div className="p-4 sm:px-6 sm:pt-6 sm:pb-24">
					<div className="mx-auto w-full space-y-4">
						<div>
							<PageTitle>Hi, {firstName}</PageTitle>
						</div>
						{primarySource ? (
							<Suspense fallback={<DashboardSkeleton />}>
								<AutoDashboard dataSource={primarySource} />
							</Suspense>
						) : (
							<DashboardDemo />
						)}
					</div>
				</div>
			</PageBody>
		</Page>
	);
}
