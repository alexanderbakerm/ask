"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format } from "date-fns";
import {
	DatabaseIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import type * as React from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { DataSourceCatalogModal } from "@/components/organization/data-source-catalog-modal";
import { DataSourceModal } from "@/components/organization/data-source-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface DataSourcesManagerProps {
	canManage: boolean;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
	connected: {
		label: "Connected",
		className:
			"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	},
	pending: {
		label: "Pending",
		className:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
	},
	error: {
		label: "Error",
		className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	},
};

function StatusBadge({ status }: { status: string }): React.JSX.Element {
	const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
	return (
		<Badge variant="outline" className={cn("border-none", style?.className)}>
			{style?.label ?? status}
		</Badge>
	);
}

export function DataSourcesManager({
	canManage,
}: DataSourcesManagerProps): React.JSX.Element {
	const utils = trpc.useUtils();
	const { data, isPending } = trpc.organization.dataSource.list.useQuery();

	const invalidate = () => utils.organization.dataSource.list.invalidate();

	const testMutation = trpc.organization.dataSource.test.useMutation({
		onSuccess: (result) => {
			if (result.ok) {
				toast.success("Connection OK");
			} else {
				toast.error(result.error ?? "Connection failed");
			}
			invalidate();
		},
		onError: (error) => toast.error(error.message || "Test failed"),
	});

	const reintrospectMutation =
		trpc.organization.dataSource.reintrospect.useMutation({
			onSuccess: () => {
				toast.success("Catalog refreshed");
				invalidate();
			},
			onError: (error) => toast.error(error.message || "Reintrospect failed"),
		});

	const deleteMutation = trpc.organization.dataSource.delete.useMutation({
		onSuccess: () => {
			toast.success("Data source deleted");
			invalidate();
		},
		onError: (error) => toast.error(error.message || "Delete failed"),
	});

	const busyId = (id: string) =>
		(testMutation.isPending && testMutation.variables?.id === id) ||
		(reintrospectMutation.isPending &&
			reintrospectMutation.variables?.id === id);

	if (isPending) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{["a", "b", "c"].map((k) => (
					<Skeleton key={k} className="h-48 w-full" />
				))}
			</div>
		);
	}

	const dataSources = data?.dataSources ?? [];

	if (dataSources.length === 0) {
		return (
			<Empty className="rounded-lg border border-dashed py-12">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<DatabaseIcon />
					</EmptyMedia>
					<EmptyTitle>No data sources yet</EmptyTitle>
					<EmptyDescription>
						{canManage
							? "Connect a PostgreSQL database (with read-only credentials) to start asking questions about your data."
							: "No data sources have been connected for this organization yet."}
					</EmptyDescription>
				</EmptyHeader>
				{canManage && (
					<EmptyContent>
						<Button onClick={() => NiceModal.show(DataSourceModal)}>
							<PlusIcon className="size-4 shrink-0" />
							Connect a data source
						</Button>
					</EmptyContent>
				)}
			</Empty>
		);
	}

	return (
		<div className="space-y-4">
			{canManage && (
				<div className="flex justify-end">
					<Button onClick={() => NiceModal.show(DataSourceModal)} size="sm">
						<PlusIcon className="size-4 shrink-0" />
						Connect a data source
					</Button>
				</div>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{dataSources.map((source) => (
					<Card key={source.id} className="flex flex-col">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 truncate">
								<DatabaseIcon className="size-4 shrink-0 text-muted-foreground" />
								<span className="truncate" title={source.name}>
									{source.name}
								</span>
							</CardTitle>
							<CardAction>
								<StatusBadge status={source.status} />
							</CardAction>
						</CardHeader>

						<CardContent className="flex-1 space-y-2 text-sm">
							<div className="space-y-1 text-muted-foreground">
								<div
									className="truncate font-mono text-xs"
									title={`${source.config.host}:${source.config.port}/${source.config.database}`}
								>
									{source.config.host}:{source.config.port}/
									{source.config.database}
								</div>
								<div className="text-xs">
									user <span className="font-medium">{source.config.user}</span>
									{" · "}schema{" "}
									<span className="font-medium">
										{source.config.schemas.join(", ")}
									</span>
								</div>
								{source.lastIntrospectedAt && (
									<div className="text-xs">
										catalog updated{" "}
										{format(
											new Date(source.lastIntrospectedAt),
											"dd MMM HH:mm",
										)}
									</div>
								)}
							</div>

							{source.status === "error" && source.lastError && (
								<div className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive text-xs">
									{source.lastError}
									{canManage && (
										<span className="text-destructive/80">
											{" "}
											Use Reintrospect to retry.
										</span>
									)}
								</div>
							)}
						</CardContent>

						<CardFooter className="justify-between gap-2 border-t">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									NiceModal.show(DataSourceCatalogModal, {
										dataSourceId: source.id,
										dataSourceName: source.name,
									})
								}
							>
								View catalog
							</Button>

							{canManage && (
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="sm"
										loading={busyId(source.id)}
										onClick={() =>
											reintrospectMutation.mutate({ id: source.id })
										}
									>
										<RefreshCwIcon className="size-3.5 shrink-0" />
										<span className="sr-only">Reintrospect</span>
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon" className="size-8">
												<MoreHorizontalIcon className="size-4 shrink-0" />
												<span className="sr-only">Actions</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() =>
													NiceModal.show(DataSourceModal, {
														dataSource: source,
													})
												}
											>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => testMutation.mutate({ id: source.id })}
											>
												Test connection
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() =>
													reintrospectMutation.mutate({ id: source.id })
												}
											>
												Reintrospect
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() =>
													NiceModal.show(ConfirmationModal, {
														title: "Delete data source?",
														message:
															"This removes the connection and its introspected catalog. Saved queries that reference it will be unlinked. This cannot be undone.",
														confirmLabel: "Delete",
														destructive: true,
														onConfirm: () =>
															deleteMutation.mutate({ id: source.id }),
													})
												}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							)}
						</CardFooter>
					</Card>
				))}
			</div>
		</div>
	);
}
