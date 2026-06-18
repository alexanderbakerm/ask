"use client";

import {
	HomeIcon,
	MonitorSmartphoneIcon,
	ShieldIcon,
	UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type MenuItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	exactMatch?: boolean;
};

type MenuGroup = {
	label: string;
	items?: MenuItem[];
};

export function UserMenuItems(): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Define menu groups directly, no subGroups or accordion
	const menuGroups: MenuGroup[] = [
		{
			label: "Application",
			items: [
				{
					label: "Home",
					href: "/dashboard",
					icon: HomeIcon,
					exactMatch: true,
				},
			],
		},
		{
			label: "Settings",
			items: [
				{
					label: "Profile",
					href: "/dashboard/settings?tab=profile",
					icon: UserIcon,
				},
				{
					label: "Security",
					href: "/dashboard/settings?tab=security",
					icon: ShieldIcon,
				},
				{
					label: "Sessions",
					href: "/dashboard/settings?tab=sessions",
					icon: MonitorSmartphoneIcon,
				},
			],
		},
	];

	const getIsActive = React.useCallback(
		(item: MenuItem): boolean => {
			if (item.exactMatch) {
				return pathname === item.href;
			}
			// Check if the href contains query params
			if (item.href.includes("?")) {
				const [itemPath, itemQuery] = item.href.split("?");
				const itemParams = new URLSearchParams(itemQuery);
				const itemTab = itemParams.get("tab");
				const currentTab = searchParams.get("tab");

				// Match if pathname matches and either:
				// 1. tabs match exactly, or
				// 2. item is the default tab (profile) and no tab is set in URL
				if (pathname === itemPath) {
					if (currentTab === itemTab) return true;
					if (itemTab === "profile" && !currentTab) return true;
				}
				return false;
			}
			return pathname.startsWith(item.href);
		},
		[pathname, searchParams],
	);

	const renderMenuItem = (item: MenuItem, index: number) => {
		const isActive = getIsActive(item);
		return (
			<SidebarMenuItem key={index}>
				<SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
					<Link href={item.href}>
						<item.icon
							className={cn(
								"size-4 shrink-0",
								isActive ? "text-foreground" : "text-muted-foreground",
							)}
						/>
						<span
							className={cn(
								isActive
									? "dark:text-foreground"
									: "dark:text-muted-foreground",
							)}
						>
							{item.label}
						</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	};

	return (
		<ScrollArea
			className="[&>[data-radix-scroll-area-viewport]>div]:flex! h-full [&>[data-radix-scroll-area-viewport]>div]:h-full [&>[data-radix-scroll-area-viewport]>div]:flex-col"
			verticalScrollBar
		>
			{menuGroups.map((group, groupIndex) => (
				<SidebarGroup key={groupIndex}>
					<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					<SidebarMenu suppressHydrationWarning>
						{group.items?.map(renderMenuItem)}
					</SidebarMenu>
				</SidebarGroup>
			))}
		</ScrollArea>
	);
}
