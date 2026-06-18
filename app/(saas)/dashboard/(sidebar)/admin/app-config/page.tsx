import type { Metadata } from "next";
import type * as React from "react";
import { AppConfigTable } from "@/components/admin/app-config/app-config-table";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";

export const metadata: Metadata = {
	title: "App Config",
};

export default function AdminAppConfigPage(): React.JSX.Element {
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: "Admin", href: "/dashboard/admin" },
							{ label: "App Config" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="App Config">
					<AppConfigTable />
				</PageContent>
			</PageBody>
		</Page>
	);
}
