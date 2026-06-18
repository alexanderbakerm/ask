import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type * as React from "react";
import { DataSourcesManager } from "@/components/organization/data-sources-manager";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";
import { isOrganizationAdmin } from "@/lib/auth/utils";

export const metadata: Metadata = {
	title: "Data Sources",
};

export default async function DataSourcesPage(): Promise<React.JSX.Element> {
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

	// Members may view/use sources; only owners/admins may manage them. The UI
	// mirrors the router's RBAC so members never see actions that would 403.
	const canManage = isOrganizationAdmin(organization, session.user);

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "Data Sources" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Data sources">
					<DataSourcesManager canManage={canManage} />
				</PageContent>
			</PageBody>
		</Page>
	);
}
