import { cookies } from "next/headers";
import type * as React from "react";
import { SidebarLayout } from "@/components/sidebar-layout";
import { UserMenuItems } from "@/components/user/user-menu-items";

export default async function AccountLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const cookieStore = await cookies();
	return (
		<SidebarLayout
			defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
			defaultWidth={cookieStore.get("sidebar_width")?.value}
			menuItems={<UserMenuItems />}
		>
			{children}
		</SidebarLayout>
	);
}
