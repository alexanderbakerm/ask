import type { Metadata } from "next";
import type * as React from "react";
import { UsersTable } from "@/components/admin/users/users-table";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageContent,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";

export const metadata: Metadata = {
	title: "Users",
};

export default function AdminUsersPage(): React.JSX.Element {
	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: "Admin", href: "/dashboard/admin" },
							{ label: "Users" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody>
				<PageContent title="Users">
					<UsersTable />
				</PageContent>
			</PageBody>
		</Page>
	);
}
