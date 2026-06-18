"use client";

import type * as React from "react";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarRail,
} from "@/components/ui/sidebar";
import { UserDropDownMenu } from "@/components/user/user-dropdown-menu";

export type SidebarLayoutProps = React.PropsWithChildren<{
	menuItems: React.ReactNode;
	defaultOpen?: boolean;
	defaultWidth?: string;
}>;

/**
 * Sidebar layout component.
 * The active organization is now obtained from Better Auth's session via useActiveOrganization hook,
 * so it no longer needs to be passed as a prop.
 */
export function SidebarLayout({
	menuItems,
	defaultOpen,
	defaultWidth,
	children,
}: SidebarLayoutProps): React.JSX.Element {
	return (
		<div className="flex h-screen w-screen flex-col overflow-hidden">
			<SidebarProvider defaultOpen={defaultOpen} defaultWidth={defaultWidth}>
				<Sidebar collapsible="icon">
					<SidebarHeader>
						<OrganizationSwitcher />
					</SidebarHeader>
					<SidebarContent className="flex flex-col overflow-hidden">
						<div className="flex-1 overflow-hidden">{menuItems}</div>
					</SidebarContent>
					<SidebarFooter>
						<UserDropDownMenu />
					</SidebarFooter>
					<SidebarRail />
				</Sidebar>
				<SidebarInset id="skip" className="size-full overflow-hidden">
					{children}
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
