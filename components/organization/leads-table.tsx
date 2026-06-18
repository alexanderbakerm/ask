"use client";

import NiceModal from "@ebay/nice-modal-react";
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsJson,
	parseAsString,
	useQueryState,
} from "nuqs";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { LeadsBulkActions } from "@/components/organization/leads-bulk-actions";
import { LeadsModal } from "@/components/organization/leads-modal";
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
import { UserAvatar } from "@/components/user/user-avatar";
import { appConfig } from "@/config/app.config";
import { useTableSelection } from "@/hooks/use-table-selection";
import { LeadSources, LeadStatuses } from "@/lib/db/schema/enums";
import { capitalize, cn } from "@/lib/utils";
import { LeadSortField } from "@/schemas/organization-lead-schemas";
import { trpc } from "@/trpc/client";

const DEFAULT_SORTING: SortingState = [{ id: "createdAt", desc: false }];

interface Lead {
	id: string;
	organizationId: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	company: string | null;
	jobTitle: string | null;
	status: string;
	source: string;
	estimatedValue: number | null;
	notes: string | null;
	assignedToId: string | null;
	createdAt: Date;
	updatedAt: Date;
	assignedTo: {
		id: string;
		name: string;
		email: string;
		image: string | null;
	} | null;
}

const statusColors: Record<string, string> = {
	new: "bg-blue-100 dark:bg-blue-900",
	contacted: "bg-yellow-100 dark:bg-yellow-900",
	qualified: "bg-purple-100 dark:bg-purple-900",
	proposal: "bg-orange-100 dark:bg-orange-900",
	negotiation: "bg-cyan-100 dark:bg-cyan-900",
	won: "bg-green-100 dark:bg-green-900",
	lost: "bg-red-100 dark:bg-red-900",
};

const sourceLabels: Record<string, string> = {
	website: "Website",
	referral: "Referral",
	social_media: "Social Media",
	advertising: "Advertising",
	cold_call: "Cold Call",
	email: "Email",
	event: "Event",
	other: "Other",
};

export function LeadsTable(): React.JSX.Element {
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

	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [sourceFilter, setSourceFilter] = useQueryState(
		"source",
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

	// Build columnFilters from URL state
	const columnFilters: ColumnFiltersState = React.useMemo(() => {
		const filters: ColumnFiltersState = [];
		if (statusFilter && statusFilter.length > 0) {
			filters.push({ id: "status", value: statusFilter });
		}
		if (sourceFilter && sourceFilter.length > 0) {
			filters.push({ id: "source", value: sourceFilter });
		}
		if (createdAtFilter && createdAtFilter.length > 0) {
			filters.push({ id: "createdAt", value: createdAtFilter });
		}
		return filters;
	}, [statusFilter, sourceFilter, createdAtFilter]);

	const handleFiltersChange = (filters: ColumnFiltersState): void => {
		const getFilterValue = (id: string): string[] => {
			const filter = filters.find((f) => f.id === id);
			return Array.isArray(filter?.value) ? (filter.value as string[]) : [];
		};

		setStatusFilter(getFilterValue("status"));
		setSourceFilter(getFilterValue("source"));
		setCreatedAtFilter(getFilterValue("createdAt"));

		if (pageIndex !== 0) {
			setPageIndex(0);
		}
	};

	const handleSortingChange = (newSorting: SortingState): void => {
		// When clearing sort, fall back to default to keep URL and state consistent
		setSorting(newSorting.length > 0 ? newSorting : DEFAULT_SORTING);
		if (pageIndex !== 0) {
			setPageIndex(0);
		}
	};

	// Build sort params from sorting state
	const sortParams = React.useMemo(() => {
		const fallbackSort = { id: "createdAt", desc: false } as const;
		const currentSort = sorting?.[0] ?? DEFAULT_SORTING[0] ?? fallbackSort;
		const sortBy = LeadSortField.options.includes(
			currentSort.id as LeadSortField,
		)
			? (currentSort.id as LeadSortField)
			: "createdAt";
		const sortOrder = currentSort.desc ? ("desc" as const) : ("asc" as const);
		return { sortBy, sortOrder };
	}, [sorting]);

	const { data, isPending } = trpc.organization.lead.list.useQuery(
		{
			limit: pageSize || appConfig.pagination.defaultLimit,
			offset:
				(pageIndex || 0) * (pageSize || appConfig.pagination.defaultLimit),
			query: searchQuery || "",
			sortBy: sortParams.sortBy,
			sortOrder: sortParams.sortOrder,
			filters: {
				status: (statusFilter || []) as (
					| "new"
					| "contacted"
					| "qualified"
					| "proposal"
					| "negotiation"
					| "won"
					| "lost"
				)[],
				source: (sourceFilter || []) as (
					| "website"
					| "referral"
					| "social_media"
					| "advertising"
					| "cold_call"
					| "email"
					| "event"
					| "other"
				)[],
				createdAt: (createdAtFilter || []) as (
					| "today"
					| "this-week"
					| "this-month"
					| "older"
				)[],
			},
		},
		{
			placeholderData: (prev: any) => prev,
		},
	);

	const { rowSelection, setRowSelection, clearSelection, removeFromSelection } =
		useTableSelection({
			total: data?.total,
			pageIndex,
			pageSize,
			setPageIndex,
		});

	const deleteLeadMutation = trpc.organization.lead.delete.useMutation({
		onSuccess: (_data, variables) => {
			toast.success("Lead deleted successfully");
			removeFromSelection([variables.id]);
			utils.organization.lead.list.invalidate();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete lead");
		},
	});

	const handleSearchQueryChange = (value: string): void => {
		if (value !== searchQuery) {
			setSearchQuery(value);
			if (pageIndex !== 0) {
				setPageIndex(0);
			}
		}
	};

	const columns: ColumnDef<Lead>[] = [
		createSelectionColumn<Lead>(),
		{
			accessorKey: "name",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => {
				const fullName = `${row.original.firstName} ${row.original.lastName}`;
				return (
					<div className="flex max-w-[200px] items-center gap-2">
						<UserAvatar className="size-6 shrink-0" name={fullName} />
						<span
							className="truncate font-medium text-foreground"
							title={fullName}
						>
							{fullName}
						</span>
					</div>
				);
			},
		},
		{
			accessorKey: "company",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Company" />
			),
			cell: ({ row }) => (
				<span
					className="block max-w-[150px] truncate text-foreground/80"
					title={row.original.company || undefined}
				>
					{row.original.company || "-"}
				</span>
			),
		},
		{
			accessorKey: "email",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Email" />
			),
			cell: ({ row }) => (
				<span
					className="block max-w-[250px] truncate text-foreground/80"
					title={row.original.email}
				>
					{row.original.email}
				</span>
			),
		},
		{
			accessorKey: "status",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => (
				<Badge
					className={cn(
						"border-none px-2 py-0.5 font-medium text-foreground text-xs shadow-none",
						statusColors[row.original.status] || "bg-gray-100 dark:bg-gray-800",
					)}
					variant="outline"
				>
					{capitalize(row.original.status.replace("_", " "))}
				</Badge>
			),
		},
		{
			accessorKey: "source",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Source" />
			),
			cell: ({ row }) => (
				<span className="text-foreground/80">
					{sourceLabels[row.original.source] ||
						capitalize(row.original.source.replace("_", " "))}
				</span>
			),
		},
		{
			accessorKey: "estimatedValue",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Value" />
			),
			cell: ({ row }) => (
				<span className="text-foreground/80">
					{row.original.estimatedValue
						? `$${row.original.estimatedValue.toLocaleString()}`
						: "-"}
				</span>
			),
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Created" />
			),
			cell: ({ row }) => (
				<span className="text-foreground/80">
					{format(row.original.createdAt, "dd MMM, yyyy")}
				</span>
			),
		},
		{
			id: "actions",
			enableSorting: false,
			cell: ({ row }) => (
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
									NiceModal.show(LeadsModal, { lead: row.original });
								}}
							>
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									NiceModal.show(ConfirmationModal, {
										title: "Delete lead?",
										message:
											"Are you sure you want to delete this lead? This action cannot be undone.",
										confirmLabel: "Delete",
										destructive: true,
										onConfirm: () =>
											deleteLeadMutation.mutate({ id: row.original.id }),
									});
								}}
								variant="destructive"
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			),
		},
	];

	const leadFilters: FilterConfig[] = [
		{
			key: "status",
			title: "Status",
			options: LeadStatuses.map((status) => ({
				value: status,
				label: capitalize(status.replace("_", " ")),
			})),
		},
		{
			key: "source",
			title: "Source",
			options: LeadSources.map((source) => ({
				value: source,
				label: sourceLabels[source] || capitalize(source.replace("_", " ")),
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
			data={(data?.leads as Lead[]) || []}
			emptyMessage="No leads found."
			enableFilters
			enablePagination
			enableRowSelection
			enableSearch
			filters={leadFilters}
			getRowId={(row) => row.id}
			loading={isPending}
			onFiltersChange={handleFiltersChange}
			onPageIndexChange={setPageIndex}
			onPageSizeChange={setPageSize}
			onRowSelectionChange={setRowSelection}
			onSearchQueryChange={handleSearchQueryChange}
			onSortingChange={handleSortingChange}
			pageIndex={pageIndex || 0}
			pageSize={pageSize || appConfig.pagination.defaultLimit}
			renderBulkActions={() => (
				<LeadsBulkActions
					rowSelection={rowSelection}
					onClearSelection={clearSelection}
				/>
			)}
			rowSelection={rowSelection}
			searchPlaceholder="Search leads..."
			searchQuery={searchQuery || ""}
			defaultSorting={DEFAULT_SORTING}
			sorting={sorting}
			toolbarActions={
				<Button onClick={() => NiceModal.show(LeadsModal)} size="sm">
					<PlusIcon className="size-4 shrink-0" />
					Add Lead
				</Button>
			}
			totalCount={data?.total ?? 0}
		/>
	);
}
