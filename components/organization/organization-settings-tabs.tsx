"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import type * as React from "react";
import { CreditsSettingsTab } from "@/components/billing/credits-settings-tab";
import { SubscriptionSettingsTab } from "@/components/billing/subscription-settings-tab";
import { DeleteOrganizationCard } from "@/components/organization/delete-organization-card";
import { OrganizationChangeNameCard } from "@/components/organization/organization-change-name-card";
import { OrganizationInviteMemberCard } from "@/components/organization/organization-invite-member-card";
import { OrganizationLogoCard } from "@/components/organization/organization-logo-card";
import { OrganizationMembersCard } from "@/components/organization/organization-members-card";
import {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
} from "@/components/ui/custom/underlined-tabs";
import { billingConfig } from "@/config/billing.config";

const tabValues = ["general", "members", "subscription", "credits"] as const;
type TabValue = (typeof tabValues)[number];

type OrganizationSettingsTabsProps = {
	isAdmin: boolean;
};

export function OrganizationSettingsTabs({
	isAdmin,
}: OrganizationSettingsTabsProps): React.JSX.Element {
	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringLiteral(tabValues).withDefault("general"),
	);

	return (
		<UnderlinedTabs
			className="w-full"
			value={tab}
			onValueChange={(value) => setTab(value as TabValue)}
		>
			<UnderlinedTabsList className="mb-6 sm:-ml-4">
				<UnderlinedTabsTrigger value="general">General</UnderlinedTabsTrigger>
				<UnderlinedTabsTrigger value="members">Members</UnderlinedTabsTrigger>
				{billingConfig.enabled && (
					<UnderlinedTabsTrigger value="subscription">
						Subscription
					</UnderlinedTabsTrigger>
				)}
				{billingConfig.enabled && (
					<UnderlinedTabsTrigger value="credits">Credits</UnderlinedTabsTrigger>
				)}
			</UnderlinedTabsList>
			<UnderlinedTabsContent value="general">
				<div className="space-y-4">
					<OrganizationLogoCard />
					<OrganizationChangeNameCard />
					<DeleteOrganizationCard />
				</div>
			</UnderlinedTabsContent>
			<UnderlinedTabsContent value="members">
				<div className="space-y-4">
					{isAdmin && <OrganizationInviteMemberCard />}
					<OrganizationMembersCard />
				</div>
			</UnderlinedTabsContent>
			{billingConfig.enabled && (
				<UnderlinedTabsContent value="subscription">
					<SubscriptionSettingsTab isAdmin={isAdmin} />
				</UnderlinedTabsContent>
			)}
			{billingConfig.enabled && (
				<UnderlinedTabsContent value="credits">
					<CreditsSettingsTab isAdmin={isAdmin} />
				</UnderlinedTabsContent>
			)}
		</UnderlinedTabs>
	);
}
