"use client";

import { Building2Icon, FileCog2Icon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
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
};

type MenuGroup = {
	label: string;
	items: MenuItem[];
};

export function AdminMenuItems(): React.JSX.Element {
	const pathname = usePathname();

	const menuGroups: MenuGroup[] = [
		{
			label: "Management",
			items: [
				{
					label: "Users",
					href: "/dashboard/admin/users",
					icon: UsersIcon,
				},
				{
					label: "Organizations",
					href: "/dashboard/admin/organizations",
					icon: Building2Icon,
				},

				{
					label: "App Config",
					href: "/dashboard/admin/app-config",
					icon: FileCog2Icon,
				},
			],
		},
	];

	const getIsActive = (item: MenuItem): boolean => {
		if (pathname === item.href) {
			return true;
		}
		return pathname.startsWith(`${item.href}/`);
	};

	return (
		<ScrollArea
			className="[&>[data-radix-scroll-area-viewport]>div]:flex! h-full [&>[data-radix-scroll-area-viewport]>div]:h-full [&>[data-radix-scroll-area-viewport]>div]:flex-col"
			verticalScrollBar
		>
			{menuGroups.map((group, groupIndex) => (
				<SidebarGroup key={groupIndex}>
					<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					<SidebarMenu>
						{group.items.map((item, itemIndex) => {
							const isActive = getIsActive(item);
							return (
								<SidebarMenuItem key={itemIndex}>
									<SidebarMenuButton
										asChild
										isActive={isActive}
										tooltip={item.label}
									>
										<Link href={item.href}>
											<item.icon
												className={cn(
													"size-4 shrink-0",
													isActive
														? "text-foreground"
														: "text-muted-foreground",
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
						})}
					</SidebarMenu>
				</SidebarGroup>
			))}
		</ScrollArea>
	);
}
