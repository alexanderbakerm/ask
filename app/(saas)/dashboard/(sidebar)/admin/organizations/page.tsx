import type { Metadata } from "next";
import type * as React from "react";
import { OrganizationsTable } from "@/components/admin/organizations/organizations-table";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";

export const metadata: Metadata = {
	title: "Organizations",
};

export default function AdminOrganizationsPage(): React.JSX.Element {
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: "Admin", href: "/dashboard/admin" },
							{ label: "Organizations" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Organizations">
					<OrganizationsTable />
				</PageContent>
			</PageBody>
		</Page>
	);
}
