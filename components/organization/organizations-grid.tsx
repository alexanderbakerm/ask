"use client";

import NiceModal from "@ebay/nice-modal-react";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, UsersIcon } from "lucide-react";
import * as React from "react";
import { CreateOrganizationModal } from "@/components/organization/create-organization-modal";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { appConfig } from "@/config/app.config";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

/**
 * Grid display of all organizations the user belongs to.
 * When an organization is selected, it sets it as active in the session
 * and navigates to the organization dashboard.
 */
export function OrganizationsGrid(): React.JSX.Element {
	const router = useProgressRouter();
	const queryClient = useQueryClient();
	const { data: allOrganizations, isPending } =
		trpc.organization.list.useQuery();
	const [selectingOrgId, setSelectingOrgId] = React.useState<string | null>(
		null,
	);

	const handleSelectOrganization = async (organizationId: string) => {
		setSelectingOrgId(organizationId);
		try {
			// Set the active organization in Better Auth session
			await authClient.organization.setActive({
				organizationId,
			});
			// Clear only organization-scoped queries to prevent stale data from previous org
			// while preserving user-level queries (like organizations list) to avoid flickering
			clearOrganizationScopedQueries(queryClient);
			// Navigate to the organization dashboard
			router.push("/dashboard/organization");
		} finally {
			setSelectingOrgId(null);
		}
	};

	if (isPending) {
		return (
			<div className="@container">
				<div className="grid @8xl:grid-cols-5 @7xl:grid-cols-4 @3xl:grid-cols-3 @xl:grid-cols-2 grid-cols-1 gap-4">
					{[...new Array(3)].map((_, i) => (
						<div
							className={cn(
								"relative flex h-36 flex-col justify-between pt-4 pb-0",
								"rounded-lg border border-border bg-background dark:border-input dark:shadow-primary/20",
							)}
							key={i}
						>
							{/* CardContent skeleton */}
							<div className="flex flex-row items-center justify-between px-4">
								<div className="flex w-full flex-row items-center gap-2 align-super text-sm">
									<Skeleton className="size-6 rounded-md" />
									<Skeleton className="h-6 w-24 rounded" />
								</div>
							</div>
							{/* CardFooter skeleton */}
							<div className="mt-auto flex items-center justify-between border-t px-4 py-2">
								<div className="flex flex-row items-center gap-2 text-xs">
									<Skeleton className="size-3 rounded-full" />
									<Skeleton className="h-4 w-12 rounded" />
								</div>
								<Skeleton className="h-8 w-16 rounded" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (allOrganizations?.length === 0) {
		return (
			<Empty className="h-60 border">
				<EmptyHeader>
					<EmptyTitle>No Organization</EmptyTitle>
					<EmptyDescription>
						{appConfig.organizations.allowUserCreation
							? "Create an organization to get started."
							: "You don't have any organizations yet. Contact an admin to get started."}
					</EmptyDescription>
				</EmptyHeader>
				{appConfig.organizations.allowUserCreation && (
					<Button
						onClick={() => NiceModal.show(CreateOrganizationModal)}
						type="button"
						variant="default"
					>
						Create an Organization
					</Button>
				)}
			</Empty>
		);
	}

	return (
		<div className="@container">
			<div className="grid @8xl:grid-cols-5 @7xl:grid-cols-4 @3xl:grid-cols-3 @xl:grid-cols-2 grid-cols-1 gap-4 animate-in fade-in duration-300">
				{/* Existing Organization Cards */}
				{allOrganizations?.map((organization) => (
					<button
						className="group block h-full cursor-pointer text-left"
						onClick={() => handleSelectOrganization(organization.id)}
						key={organization.id}
						type="button"
						disabled={selectingOrgId === organization.id}
					>
						<Card
							className={cn(
								"relative flex h-36 flex-col justify-between rounded-lg pt-4 pb-0 transition-all hover:bg-secondary/20 hover:shadow-xs active:bg-secondary/50 active:shadow-lg",
								"border border-border dark:border-input dark:shadow-primary/20",
								selectingOrgId === organization.id && "opacity-70",
							)}
						>
							<CardContent className="flex flex-row items-center justify-between px-4">
								<div className="flex flex-row items-center gap-2 align-super text-sm transition-colors group-hover:text-secondary-foreground">
									<OrganizationLogo
										className="pointer-events-none size-6 select-none outline-none! ring-0!"
										name={organization.name}
										src={organization.logo}
									/>
									<span className="font-semibold text-foreground">
										{organization.name}
									</span>
								</div>
							</CardContent>
							<CardFooter className="mt-auto flex items-center justify-between border-t px-4 py-2!">
								<div className="flex flex-row items-center gap-2 text-muted-foreground text-xs">
									<UsersIcon className="size-3" />
									{organization.membersCount
										? `${organization.membersCount} ${organization.membersCount === 1 ? "member" : "members"}`
										: "members"}
								</div>
								<div
									className={buttonVariants({ variant: "outline", size: "sm" })}
								>
									Open
								</div>
							</CardFooter>
						</Card>
					</button>
				))}
				{appConfig.organizations.allowUserCreation && (
					<button
						className={cn(
							buttonVariants({ variant: "outline" }),
							"group relative flex h-36 items-center justify-center rounded-lg border border-border p-4 transition-all hover:bg-secondary/20 hover:shadow-xs active:bg-secondary/50 active:shadow-lg dark:border-input dark:shadow-primary/20",
						)}
						onClick={() => NiceModal.show(CreateOrganizationModal)}
						type="button"
					>
						<div className="flex flex-row items-center gap-2 text-center">
							<PlusIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-secondary-foreground" />
							<span className="font-medium text-muted-foreground text-sm transition-colors group-hover:text-secondary-foreground">
								Create an Organization
							</span>
						</div>
					</button>
				)}
			</div>
		</div>
	);
}
