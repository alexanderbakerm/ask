import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type * as React from "react";
import { AdminMenuItems } from "@/components/admin/admin-menu-items";
import { SidebarLayout } from "@/components/sidebar-layout";
import { getSession } from "@/lib/auth/server";

export default async function AdminLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const session = await getSession();
	if (!session || session.user?.role !== "admin") {
		redirect("/dashboard");
	}

	const cookieStore = await cookies();

	return (
		<SidebarLayout
			defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
			defaultWidth={cookieStore.get("sidebar_width")?.value}
			menuItems={<AdminMenuItems />}
		>
			{children}
		</SidebarLayout>
	);
}
