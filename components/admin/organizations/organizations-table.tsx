"use client";

import NiceModal from "@ebay/nice-modal-react";
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
	AlertTriangleIcon,
	CoinsIcon,
	CreditCardIcon,
	ExternalLinkIcon,
	MoreHorizontalIcon,
} from "lucide-react";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsJson,
	parseAsString,
	useQueryState,
} from "nuqs";
import * as React from "react";
import { toast } from "sonner";
import { AdjustCreditsModal } from "@/components/admin/credits/adjust-credits-modal";
import { OrganizationBulkActions } from "@/components/admin/organizations/organization-bulk-actions";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	createSelectionColumn,
	DataTable,
	type FilterConfig,
	SortableColumnHeader,
} from "@/components/ui/custom/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { appConfig } from "@/config/app.config";
import { billingConfig } from "@/config/billing.config";
import { useTableSelection } from "@/hooks/use-table-selection";
import { SubscriptionStatus } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";
import { OrganizationSortField } from "@/schemas/admin-organization-schemas";
import { trpc } from "@/trpc/client";

const DEFAULT_SORTING: SortingState = [{ id: "name", desc: false }];

const statusStyles: Record<
	string,
	{ label: string; bgColor: string; textColor: string }
> = {
	[SubscriptionStatus.active]: {
		label: "Active",
		bgColor: "bg-green-100 dark:bg-green-900",
		textColor: "text-green-700 dark:text-green-300",
	},
	[SubscriptionStatus.trialing]: {
		label: "Trialing",
		bgColor: "bg-blue-100 dark:bg-blue-900",
		textColor: "text-blue-700 dark:text-blue-300",
	},
	[SubscriptionStatus.canceled]: {
		label: "Canceled",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		textColor: "text-gray-700 dark:text-gray-300",
	},
	[SubscriptionStatus.pastDue]: {
		label: "Past Due",
		bgColor: "bg-red-100 dark:bg-red-900",
		textColor: "text-red-700 dark:text-red-300",
	},
	[SubscriptionStatus.paused]: {
		label: "Paused",
		bgColor: "bg-yellow-100 dark:bg-yellow-900",
		textColor: "text-yellow-700 dark:text-yellow-300",
	},
	[SubscriptionStatus.incomplete]: {
		label: "Incomplete",
		bgColor: "bg-orange-100 dark:bg-orange-900",
		textColor: "text-orange-700 dark:text-orange-300",
	},
	[SubscriptionStatus.incompleteExpired]: {
		label: "Expired",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		textColor: "text-gray-700 dark:text-gray-300",
	},
	[SubscriptionStatus.unpaid]: {
		label: "Unpaid",
		bgColor: "bg-red-100 dark:bg-red-900",
		textColor: "text-red-700 dark:text-red-300",
	},
};

const balanceRangeStyles: Record<
	string,
	{ label: string; bgColor: string; textColor: string }
> = {
	zero: {
		label: "Zero",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		textColor: "text-gray-700 dark:text-gray-300",
	},
	low: {
		label: "Low",
		bgColor: "bg-orange-100 dark:bg-orange-900",
		textColor: "text-orange-700 dark:text-orange-300",
	},
	medium: {
		label: "Medium",
		bgColor: "bg-blue-100 dark:bg-blue-900",
		textColor: "text-blue-700 dark:text-blue-300",
	},
	high: {
		label: "High",
		bgColor: "bg-green-100 dark:bg-green-900",
		textColor: "text-green-700 dark:text-green-300",
	},
};

type Organization = {
	id: string;
	name: string;
	logo: string | null;
	createdAt: Date;
	metadata: string | null;
	membersCount: number;
	pendingInvites: number;
	subscriptionStatus: SubscriptionStatus | null;
	subscriptionPlan: string | null;
	subscriptionId: string | null;
	cancelAtPeriodEnd: boolean | null;
	trialEnd: Date | null;
	credits: number | null;
};

export function OrganizationsTable(): React.JSX.Element {
	const [searchQuery, setSearchQuery] = useQueryState(
		"query",
		parseAsString.withDefault("").withOptions({
			shallow: true,
		}),
	);

	const [pageIndex, setPageIndex] = useQueryState(
		"pageIndex",
		parseAsInteger.withDefault(0).withOptions({
			shallow: true,
		}),
	);

	const [pageSize, setPageSize] = useQueryState(
		"pageSize",
		parseAsInteger.withDefault(appConfig.pagination.defaultLimit).withOptions({
			shallow: true,
		}),
	);

	const [membersCountFilter, setMembersCountFilter] = useQueryState(
		"membersCount",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [createdAtFilter, setCreatedAtFilter] = useQueryState(
		"createdAt",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useQueryState(
		"subscriptionStatus",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [subscriptionIntervalFilter, setSubscriptionIntervalFilter] =
		useQueryState(
			"subscriptionInterval",
			parseAsArrayOf(parseAsString).withDefault([]).withOptions({
				shallow: true,
			}),
		);

	const [balanceRangeFilter, setBalanceRangeFilter] = useQueryState(
		"balanceRange",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [sorting, setSorting] = useQueryState<SortingState>(
		"sort",
		parseAsJson<SortingState>((value) => {
			if (!Array.isArray(value)) return DEFAULT_SORTING;
			return value.filter(
				(item) =>
					item &&
					typeof item === "object" &&
					"id" in item &&
					typeof item.desc === "boolean",
			) as SortingState;
		})
			.withDefault(DEFAULT_SORTING)
			.withOptions({ shallow: true }),
	);

	const utils = trpc.useUtils();

	const deleteOrganizationMutation =
		trpc.admin.organization.delete.useMutation();

	const syncFromStripeMutation =
		trpc.admin.organization.syncFromStripe.useMutation();

	const cancelSubscriptionMutation =
		trpc.admin.organization.cancelSubscription.useMutation({
			onMutate: async ({ subscriptionId, immediate }) => {
				// Cancel outgoing refetches
				await utils.admin.organization.list.cancel(queryInput);

				// Snapshot the previous value
				const previousData = utils.admin.organization.list.getData(queryInput);

				// Optimistically update to the new value
				if (previousData) {
					utils.admin.organization.list.setData(queryInput, {
						...previousData,
						organizations: previousData.organizations.map((org) =>
							org.subscriptionId === subscriptionId
								? {
										...org,
										subscriptionStatus: immediate
											? SubscriptionStatus.canceled
											: org.subscriptionStatus,
										cancelAtPeriodEnd: immediate ? org.cancelAtPeriodEnd : true,
									}
								: org,
						),
					});
				}

				return { previousData };
			},
			onSuccess: (result) => {
				toast.success(
					result.immediate
						? "Subscription canceled immediately"
						: "Subscription set to cancel at period end",
				);
			},
			onError: (error, _variables, context) => {
				toast.error(`Failed to cancel subscription: ${error.message}`);
				if (context?.previousData) {
					utils.admin.organization.list.setData(
						queryInput,
						context.previousData,
					);
				}
			},
			onSettled: () => {
				utils.admin.organization.list.invalidate();
			},
		});

	// Build columnFilters from URL state
	const columnFilters: ColumnFiltersState = React.useMemo(() => {
		const filters: ColumnFiltersState = [];
		if (membersCountFilter && membersCountFilter.length > 0) {
			filters.push({ id: "membersCount", value: membersCountFilter });
		}
		if (createdAtFilter && createdAtFilter.length > 0) {
			filters.push({ id: "createdAt", value: createdAtFilter });
		}
		if (subscriptionStatusFilter && subscriptionStatusFilter.length > 0) {
			filters.push({
				id: "subscriptionStatus",
				value: subscriptionStatusFilter,
			});
		}
		if (subscriptionIntervalFilter && subscriptionIntervalFilter.length > 0) {
			filters.push({
				id: "subscriptionInterval",
				value: subscriptionIntervalFilter,
			});
		}
		if (balanceRangeFilter && balanceRangeFilter.length > 0) {
			filters.push({ id: "balanceRange", value: balanceRangeFilter });
		}
		return filters;
	}, [
		membersCountFilter,
		createdAtFilter,
		subscriptionStatusFilter,
		subscriptionIntervalFilter,
		balanceRangeFilter,
	]);

	const handleFiltersChange = (filters: ColumnFiltersState): void => {
		const getFilterValue = (id: string): string[] => {
			const filter = filters.find((f) => f.id === id);
			return Array.isArray(filter?.value) ? (filter.value as string[]) : [];
		};

		setMembersCountFilter(getFilterValue("membersCount"));
		setCreatedAtFilter(getFilterValue("createdAt"));
		setSubscriptionStatusFilter(getFilterValue("subscriptionStatus"));
		setSubscriptionIntervalFilter(getFilterValue("subscriptionInterval"));
		setBalanceRangeFilter(getFilterValue("balanceRange"));

		if (pageIndex !== 0) {
			setPageIndex(0);
		}
	};

	const handleSortingChange = (newSorting: SortingState): void => {
		setSorting(newSorting.length > 0 ? newSorting : DEFAULT_SORTING);
		if (pageIndex !== 0) {
			setPageIndex(0);
		}
	};

	// Build sort params from sorting state
	const sortParams = React.useMemo(() => {
		const fallbackSort = { id: "name", desc: false } as const;
		const currentSort = sorting?.[0] ?? DEFAULT_SORTING[0] ?? fallbackSort;
		const sortBy = OrganizationSortField.options.includes(
			currentSort.id as OrganizationSortField,
		)
			? (currentSort.id as OrganizationSortField)
			: "name";
		const sortOrder = currentSort.desc ? ("desc" as const) : ("asc" as const);
		return { sortBy, sortOrder };
	}, [sorting]);

	// Build query input for useQuery and optimistic updates
	const queryInput = React.useMemo(
		() => ({
			limit: pageSize || appConfig.pagination.defaultLimit,
			offset:
				(pageIndex || 0) * (pageSize || appConfig.pagination.defaultLimit),
			query: searchQuery || "",
			sortBy: sortParams.sortBy,
			sortOrder: sortParams.sortOrder,
			filters: {
				membersCount: (membersCountFilter || []) as any,
				createdAt: (createdAtFilter || []) as any,
				subscriptionStatus: (subscriptionStatusFilter || []) as any,
				subscriptionInterval: (subscriptionIntervalFilter || []) as any,
				balanceRange: (balanceRangeFilter || []) as any,
			},
		}),
		[
			pageSize,
			pageIndex,
			searchQuery,
			sortParams,
			membersCountFilter,
			createdAtFilter,
			subscriptionStatusFilter,
			subscriptionIntervalFilter,
			balanceRangeFilter,
		],
	);

	const { data, isPending } = trpc.admin.organization.list.useQuery(
		queryInput,
		{
			placeholderData: (prev) => prev,
		},
	);

	const { rowSelection, setRowSelection, clearSelection } = useTableSelection({
		total: data?.total,
		pageIndex,
		pageSize,
		setPageIndex,
	});

	const handleSearchQueryChange = (value: string): void => {
		if (value !== searchQuery) {
			setSearchQuery(value);
			if (pageIndex !== 0) {
				setPageIndex(0);
			}
		}
	};

	const columns: ColumnDef<Organization>[] = [
		createSelectionColumn<Organization>(),
		{
			accessorKey: "name",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Organization" />
			),
			cell: ({
				row: {
					original: { name, logo },
				},
			}) => (
				<div className="flex items-center gap-2 py-2">
					<OrganizationLogo className="size-6" name={name} src={logo} />
					<div className="font-medium text-foreground">{name}</div>
				</div>
			),
		},
		{
			accessorKey: "membersCount",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Members" />
			),
			cell: ({
				row: {
					original: { membersCount },
				},
			}) => (
				<div className="text-foreground/80">
					{membersCount} {membersCount === 1 ? "member" : "members"}
				</div>
			),
			filterFn: (row, id, value) => {
				const count = row.getValue(id) as number;
				return value.some((range: string) => {
					switch (range) {
						case "0":
							return count === 0;
						case "1-5":
							return count >= 1 && count <= 5;
						case "6-10":
							return count >= 6 && count <= 10;
						case "11+":
							return count > 10;
						default:
							return false;
					}
				});
			},
		},
		{
			accessorKey: "pendingInvites",
			enableSorting: false,
			header: () => (
				<div className="font-medium text-foreground text-xs">
					Pending Invites
				</div>
			),
			cell: ({ row }) => {
				const pendingInvites = row.original.pendingInvites;
				return (
					<div className="text-foreground/80 text-xs">{pendingInvites}</div>
				);
			},
		},
		{
			accessorKey: "subscriptionStatus",
			enableSorting: false,
			header: () => (
				<div className="font-medium text-foreground text-xs">Plan</div>
			),
			cell: ({ row }) => {
				const status = row.original.subscriptionStatus;
				if (!status) {
					return <span className="text-foreground/80 text-xs">Free</span>;
				}

				const priceId = row.original.subscriptionPlan;
				const plan = priceId
					? Object.values(billingConfig.plans).find((p) => {
							const planWithPrices = p as {
								prices?: { stripePriceId: string }[];
							};
							return planWithPrices.prices?.some(
								(pr) => pr.stripePriceId === priceId,
							);
						})
					: null;

				const planLabel =
					plan?.name ?? (priceId?.includes("pro") ? "Pro" : "Paid");
				const cancelAtPeriodEnd = row.original.cancelAtPeriodEnd;
				const trialEnd = row.original.trialEnd;
				const isTrialing =
					status === (SubscriptionStatus.trialing as SubscriptionStatus);

				// Capitalize status for display
				const statusLabel =
					status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

				return (
					<div className="flex items-center gap-2">
						<span className="text-foreground/80 text-xs">
							{planLabel} • {statusLabel}
						</span>

						{cancelAtPeriodEnd && (
							<Tooltip>
								<TooltipTrigger>
									<AlertTriangleIcon className="size-3.5 text-amber-500" />
								</TooltipTrigger>
								<TooltipContent>Cancels at period end</TooltipContent>
							</Tooltip>
						)}

						{isTrialing && trialEnd && (
							<Tooltip>
								<TooltipTrigger>
									<span className="text-[10px] text-muted-foreground whitespace-nowrap">
										Trial ends {format(trialEnd, "MMM d")}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									Trial expires on {format(trialEnd, "PPP")}
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				);
			},
		},
		{
			accessorKey: "credits",
			enableSorting: false,
			header: () => (
				<div className="font-medium text-foreground text-xs">Credits</div>
			),
			cell: ({ row }) => {
				const credits = row.original.credits ?? 0;

				return (
					<div className="text-foreground/80 text-xs font-medium">
						{credits.toLocaleString()}
					</div>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Created" />
			),
			cell: ({
				row: {
					original: { createdAt },
				},
			}) => (
				<div className="text-foreground/80">
					{format(createdAt, "dd MMM, yyyy")}
				</div>
			),
			filterFn: (row, id, value) => {
				const date = row.getValue(id) as Date;
				const now = new Date();
				return value.some((range: string) => {
					switch (range) {
						case "today": {
							const todayStart = new Date(
								now.getFullYear(),
								now.getMonth(),
								now.getDate(),
							);
							const todayEnd = new Date(
								now.getFullYear(),
								now.getMonth(),
								now.getDate() + 1,
							);
							return date >= todayStart && date < todayEnd;
						}
						case "this-week": {
							// Adjust to the start of the current week (Sunday)
							const weekStart = new Date(now);
							weekStart.setDate(now.getDate() - now.getDay());
							weekStart.setHours(0, 0, 0, 0);
							return date >= weekStart;
						}
						case "this-month": {
							const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
							monthStart.setHours(0, 0, 0, 0);
							return date >= monthStart;
						}
						case "older": {
							// Defined as older than a month
							const monthAgo = new Date(
								now.getFullYear(),
								now.getMonth() - 1,
								now.getDate(),
							);
							monthAgo.setHours(23, 59, 59, 999); // End of the day a month ago
							return date <= monthAgo;
						}
						default:
							return false;
					}
				});
			},
		},
		{
			id: "actions",
			enableSorting: false,
			cell: ({ row }) => {
				const {
					id,
					name,
					subscriptionId,
					subscriptionStatus: status,
				} = row.original;
				return (
					<div className="flex justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
									size="icon"
									variant="ghost"
								>
									<MoreHorizontalIcon className="shrink-0" />
									<span className="sr-only">Open menu</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => {
										NiceModal.show(ConfirmationModal, {
											title: "Sync from Stripe",
											message: `Sync subscriptions and credit purchases for ${name} from Stripe?`,
											confirmLabel: "Sync",
											onConfirm: async () => {
												await syncFromStripeMutation.mutateAsync(
													{ organizationIds: [id] },
													{
														onSuccess: (result) => {
															const subResult = result.subscriptions;
															const orderResult = result.orders;

															if (
																subResult.failed === 0 &&
																subResult.skipped === 0 &&
																orderResult.failed === 0
															) {
																toast.success(
																	"Successfully synced billing and credit data from Stripe.",
																);
															} else {
																const issues = [];
																if (subResult.failed > 0)
																	issues.push(
																		`${subResult.failed} subscriptions failed`,
																	);
																if (subResult.skipped > 0)
																	issues.push(
																		`${subResult.skipped} skipped (no Stripe ID)`,
																	);
																if (orderResult.failed > 0)
																	issues.push(
																		`${orderResult.failed} orders failed`,
																	);

																toast.warning(
																	`Sync completed with issues: ${issues.join(", ")}.`,
																);
															}
															utils.admin.organization.list.invalidate();
														},
														onError: (error) => {
															toast.error(`Failed to sync: ${error.message}`);
														},
													},
												);
											},
										});
									}}
								>
									Sync from Stripe
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault();
										NiceModal.show(AdjustCreditsModal, {
											organizationId: id,
											organizationName: name,
											currentBalance: row.original.credits ?? 0,
										});
									}}
								>
									Adjust credits
								</DropdownMenuItem>

								{subscriptionId && (
									<>
										<DropdownMenuItem asChild>
											<a
												href={`https://dashboard.stripe.com/subscriptions/${subscriptionId}`}
												target="_blank"
												rel="noreferrer"
											>
												<ExternalLinkIcon className="mr-2 size-4 text-muted-foreground" />
												Open in Stripe
											</a>
										</DropdownMenuItem>

										{!row.original.cancelAtPeriodEnd &&
											status !== SubscriptionStatus.canceled && (
												<DropdownMenuItem
													className="text-destructive focus:bg-destructive/10 focus:text-destructive"
													onSelect={(e) => {
														e.preventDefault();
														NiceModal.show(ConfirmationModal, {
															title: "Cancel subscription?",
															message: `Are you sure you want to cancel the subscription for ${name} at the end of the current period?`,
															confirmText: "Cancel at period end",
															variant: "destructive",
															onConfirm: () =>
																cancelSubscriptionMutation.mutate({
																	subscriptionId,
																	immediate: false,
																}),
														});
													}}
												>
													<AlertTriangleIcon className="mr-2 size-4" />
													Cancel at period end
												</DropdownMenuItem>
											)}
									</>
								)}

								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => {
										NiceModal.show(ConfirmationModal, {
											title: "Delete organization",
											message:
												"Are you sure you want to delete this organization? This action cannot be undone.",
											confirmLabel: "Delete",
											destructive: true,
											onConfirm: async () => {
												await deleteOrganizationMutation.mutateAsync(
													{ id },
													{
														onSuccess: () => {
															toast.success(
																"Organization has been deleted successfully!",
															);
															utils.organization.get.invalidate();
															utils.organization.list.invalidate();
															utils.admin.organization.list.invalidate();
														},
														onError: () => {
															toast.success(
																"Organization could not be deleted. Please try again.",
															);
														},
													},
												);
											},
										});
									}}
									variant="destructive"
								>
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				);
			},
		},
	];

	const organizationFilters: FilterConfig[] = [
		{
			key: "membersCount",
			title: "Members",
			options: [
				{ value: "0", label: "0 members" },
				{ value: "1-5", label: "1-5 members" },
				{ value: "6-10", label: "6-10 members" },
				{ value: "11+", label: "11+ members" },
			],
		},
		{
			key: "subscriptionStatus",
			title: "Subscription Status",
			options: Object.entries(statusStyles).map(([value, { label }]) => ({
				label,
				value,
			})),
		},
		{
			key: "subscriptionInterval",
			title: "Billing Interval",
			options: [
				{ label: "Monthly", value: "month" },
				{ label: "Yearly", value: "year" },
			],
		},
		{
			key: "balanceRange",
			title: "Credit Balance",
			options: Object.entries(balanceRangeStyles).map(([value, { label }]) => ({
				label,
				value,
			})),
		},
		{
			key: "createdAt",
			title: "Created",
			options: [
				{ value: "today", label: "Today" },
				{ value: "this-week", label: "This week" },
				{ value: "this-month", label: "This month" },
				{ value: "older", label: "Older" },
			],
		},
	];

	return (
		<DataTable
			columnFilters={columnFilters}
			columns={columns}
			data={data?.organizations || []}
			defaultSorting={DEFAULT_SORTING}
			emptyMessage="No organization found."
			enableFilters
			enablePagination
			enableRowSelection
			enableSearch
			filters={organizationFilters}
			loading={isPending}
			onFiltersChange={handleFiltersChange}
			onPageIndexChange={setPageIndex}
			onPageSizeChange={setPageSize}
			onRowSelectionChange={setRowSelection}
			onSearchQueryChange={handleSearchQueryChange}
			onSortingChange={handleSortingChange}
			pageIndex={pageIndex || 0}
			pageSize={pageSize || appConfig.pagination.defaultLimit}
			getRowId={(row) => row.id}
			renderBulkActions={() => (
				<OrganizationBulkActions
					rowSelection={rowSelection}
					onClearSelection={clearSelection}
				/>
			)}
			rowSelection={rowSelection}
			searchPlaceholder="Search organizations..."
			searchQuery={searchQuery || ""}
			sorting={sorting}
			totalCount={data?.total ?? 0}
		/>
	);
}
