"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import type * as React from "react";
import {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
} from "@/components/ui/custom/underlined-tabs";
import { ActiveSessionsCard } from "@/components/user/active-sessions-card";
import { ChangeEmailCard } from "@/components/user/change-email-card";
import { ChangeNameCard } from "@/components/user/change-name-card";
import { ChangePasswordCard } from "@/components/user/change-password-card";
import { ConnectedAccountsCard } from "@/components/user/connected-accounts-card";
import { DeleteAccountCard } from "@/components/user/delete-account-card";
import { SetPasswordCard } from "@/components/user/set-password-card";
import { TwoFactorCard } from "@/components/user/two-factor-card";
import { UserAvatarCard } from "@/components/user/user-avatar-card";
import { authConfig } from "@/config/auth.config";

const tabValues = ["profile", "security", "sessions"] as const;
type TabValue = (typeof tabValues)[number];

type AccountSettingsTabsProps = {
	userHasPassword: boolean;
};

export function AccountSettingsTabs({
	userHasPassword,
}: AccountSettingsTabsProps): React.JSX.Element {
	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringLiteral(tabValues).withDefault("profile"),
	);

	return (
		<UnderlinedTabs
			className="w-full"
			value={tab}
			onValueChange={(value) => setTab(value as TabValue)}
		>
			<UnderlinedTabsList className="mb-6 sm:-ml-4">
				<UnderlinedTabsTrigger value="profile">Profile</UnderlinedTabsTrigger>
				<UnderlinedTabsTrigger value="security">Security</UnderlinedTabsTrigger>
				<UnderlinedTabsTrigger value="sessions">Sessions</UnderlinedTabsTrigger>
			</UnderlinedTabsList>
			<UnderlinedTabsContent value="profile">
				<div className="space-y-4">
					<UserAvatarCard />
					<ChangeNameCard />
					<ChangeEmailCard />
					<DeleteAccountCard />
				</div>
			</UnderlinedTabsContent>
			<UnderlinedTabsContent value="security">
				<div className="space-y-4">
					{userHasPassword ? <ChangePasswordCard /> : <SetPasswordCard />}
					<TwoFactorCard hasCredentialAccount={userHasPassword} />
					{authConfig.enableSocialLogin && <ConnectedAccountsCard />}
				</div>
			</UnderlinedTabsContent>
			<UnderlinedTabsContent value="sessions">
				<div className="space-y-4">
					<ActiveSessionsCard />
				</div>
			</UnderlinedTabsContent>
		</UnderlinedTabs>
	);
}
