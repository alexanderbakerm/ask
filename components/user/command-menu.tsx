"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import {
	BotIcon,
	CreditCardIcon,
	HomeIcon,
	LayoutDashboardIcon,
	MonitorSmartphoneIcon,
	SettingsIcon,
	ShieldIcon,
	UserIcon,
	UserSearchIcon,
	UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type * as React from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

type NavItem = {
	title: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
};

const userNavItems: NavItem[] = [
	{
		title: "Home",
		href: "/dashboard",
		icon: HomeIcon,
	},
	{
		title: "Profile",
		href: "/dashboard/settings?tab=profile",
		icon: UserIcon,
	},
	{
		title: "Security",
		href: "/dashboard/settings?tab=security",
		icon: ShieldIcon,
	},
	{
		title: "Sessions",
		href: "/dashboard/settings?tab=sessions",
		icon: MonitorSmartphoneIcon,
	},
];

const organizationNavItems: NavItem[] = [
	{
		title: "Dashboard",
		href: "/dashboard/organization",
		icon: LayoutDashboardIcon,
	},
	{
		title: "Leads",
		href: "/dashboard/organization/leads",
		icon: UserSearchIcon,
	},
	{
		title: "AI Chatbot",
		href: "/dashboard/organization/ask",
		icon: BotIcon,
	},
	{
		title: "General Settings",
		href: "/dashboard/organization/settings?tab=general",
		icon: SettingsIcon,
	},
	{
		title: "Members",
		href: "/dashboard/organization/settings?tab=members",
		icon: UsersIcon,
	},
	{
		title: "Subscription",
		href: "/dashboard/organization/settings?tab=subscription",
		icon: CreditCardIcon,
	},
];

export type CommandMenuProps = NiceModalHocProps;

export const CommandMenu = NiceModal.create<CommandMenuProps>(() => {
	const modal = useEnhancedModal();
	const router = useRouter();

	const navigationGroups = [
		{
			heading: "Account",
			items: userNavItems,
		},
		{
			heading: "Organization",
			items: organizationNavItems,
		},
	];

	return (
		<CommandDialog
			open={modal.visible}
			onOpenChange={modal.handleOpenChange}
			className="max-w-lg"
		>
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				{navigationGroups.map((group) => (
					<CommandGroup key={group.heading} heading={group.heading}>
						{group.items.map((item) => (
							<CommandItem
								key={item.href}
								onSelect={() => {
									router.push(item.href);
									modal.handleClose();
								}}
							>
								<item.icon className="mr-2 size-4 shrink-0 text-muted-foreground" />
								<span>{item.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
});
