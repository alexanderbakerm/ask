"use client";

import * as React from "react";
import { OrganizationInvitationsTable } from "@/components/organization/organization-invitations-table";
import { OrganizationMembersTable } from "@/components/organization/organization-members-table";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/client";

/**
 * Card component for managing organization members.
 * Uses the active organization from session.
 */
export function OrganizationMembersCard(): React.JSX.Element {
	const [activeTab, setActiveTab] = React.useState("members");
	const { data: organization } = authClient.useActiveOrganization();

	if (!organization) {
		return <div>Loading...</div>;
	}

	return (
		<Card>
			<CardHeader className="flex flex-row justify-between">
				<div className="flex flex-col space-y-1.5">
					<CardTitle>Members</CardTitle>
					<CardDescription>
						See all active members and the pending invites of your organization.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Tabs onValueChange={(tab) => setActiveTab(tab)} value={activeTab}>
					<TabsList className="mb-4">
						<TabsTrigger value="members">Active Members</TabsTrigger>
						<TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
					</TabsList>
					<TabsContent value="members">
						<OrganizationMembersTable organizationId={organization.id} />
					</TabsContent>
					<TabsContent value="invitations">
						<OrganizationInvitationsTable organizationId={organization.id} />
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
