"use client";

import {
	BotIcon,
	ChevronRight,
	CoinsIcon,
	CreditCardIcon,
	DatabaseIcon,
	LayoutDashboardIcon,
	SettingsIcon,
	UserSearchIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type MenuItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	external?: boolean;
	exactMatch?: boolean;
};

type MenuGroup = {
	label: string;
	items: MenuItem[];
	collapsible?: boolean;
	defaultOpen?: boolean;
};

export function OrganizationMenuItems(): React.JSX.Element {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { state } = useSidebar();
	const [openGroup, setOpenGroup] = React.useState<string>("Acquisition");

	const basePath = "/dashboard/organization";

	const menuGroups: MenuGroup[] = [
		{
			label: "Application",
			items: [
				{
					label: "Dashboard",
					href: basePath,
					icon: LayoutDashboardIcon,
					exactMatch: true,
				},
				{
					label: "Leads",
					href: `${basePath}/leads`,
					icon: UserSearchIcon,
				},
				{
					label: "AI Chatbot",
					href: `${basePath}/ask`,
					icon: BotIcon,
				},
				{
					label: "Data Sources",
					href: `${basePath}/data-sources`,
					icon: DatabaseIcon,
				},
			],
			collapsible: false,
		},
		{
			label: "Settings",
			items: [
				{
					label: "General",
					href: `${basePath}/settings?tab=general`,
					icon: SettingsIcon,
				},
				{
					label: "Members",
					href: `${basePath}/settings?tab=members`,
					icon: UsersIcon,
				},
				{
					label: "Subscription",
					href: `${basePath}/settings?tab=subscription`,
					icon: CreditCardIcon,
				},
				{
					label: "Credits",
					href: `${basePath}/settings?tab=credits`,
					icon: CoinsIcon,
				},
			],
			collapsible: false,
		},
	];

	const getIsActive = React.useCallback(
		(item: MenuItem): boolean => {
			if (item.external) {
				return false;
			}
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
				// 2. item is the default tab (general) and no tab is set in URL
				if (pathname === itemPath) {
					if (currentTab === itemTab) return true;
					if (itemTab === "general" && !currentTab) return true;
				}
				return false;
			}
			return pathname.startsWith(item.href);
		},
		[pathname, searchParams],
	);

	const isCollapsed = state === "collapsed";

	const handleGroupToggle = (groupLabel: string) => {
		setOpenGroup(openGroup === groupLabel ? "" : groupLabel);
	};

	return (
		<ScrollArea
			className="[&>[data-radix-scroll-area-viewport]>div]:flex! h-full [&>[data-radix-scroll-area-viewport]>div]:h-full [&>[data-radix-scroll-area-viewport]>div]:flex-col [&>[data-radix-scroll-area-viewport]>div]:-space-y-1"
			/* Overriding the hardcoded { disply:table } to get full flex height */
			verticalScrollBar
		>
			{menuGroups.map((group, groupIndex) => {
				if (!group.collapsible) {
					return (
						<React.Fragment key={groupIndex}>
							<SidebarGroup className="pb-1">
								{group.label && (
									<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
								)}
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
													<Link
														href={item.href}
														{...(item.external && {
															target: "_blank",
															rel: "noopener noreferrer",
														})}
													>
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
						</React.Fragment>
					);
				}

				// When collapsed, show all items as individual menu buttons
				if (isCollapsed) {
					return (
						<SidebarGroup className="pb-1" key={groupIndex}>
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
												<Link
													href={item.href}
													{...(item.external && {
														target: "_blank",
														rel: "noopener noreferrer",
													})}
												>
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
					);
				}

				// When expanded, show collapsible groups
				const isOpen = openGroup === group.label;
				return (
					<SidebarGroup className="pb-1" key={groupIndex}>
						<SidebarMenu>
							<Collapsible
								className="group/collapsible"
								onOpenChange={() => handleGroupToggle(group.label)}
								open={isOpen}
							>
								<SidebarMenuItem>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton
											className="flex w-full items-center justify-between px-2 font-medium text-sidebar-foreground/70 text-xs"
											tooltip={group.label}
										>
											<span>{group.label}</span>
											<ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub className="ml-0 border-0">
											{group.items.map((item, itemIndex) => {
												const isActive = getIsActive(item);
												return (
													<SidebarMenuSubItem key={itemIndex}>
														<SidebarMenuSubButton asChild isActive={isActive}>
															<Link
																href={item.href}
																{...(item.external && {
																	target: "_blank",
																	rel: "noopener noreferrer",
																})}
															>
																<item.icon className={cn("size-4 shrink-0")} />
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
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												);
											})}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>
						</SidebarMenu>
					</SidebarGroup>
				);
			})}
		</ScrollArea>
	);
}
