"use client";

import NiceModal from "@ebay/nice-modal-react";
import type {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
	BanIcon,
	CheckIcon,
	ClockIcon,
	MoreHorizontalIcon,
	NotepadTextIcon,
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
import { BanUserModal } from "@/components/admin/users/ban-user-modal";
import { UserBulkActions } from "@/components/admin/users/user-bulk-actions";
import { ConfirmationModal } from "@/components/confirmation-modal";
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
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user/user-avatar";
import { appConfig } from "@/config/app.config";
import { useTableSelection } from "@/hooks/use-table-selection";
import { authClient } from "@/lib/auth/client";
import { capitalize, cn } from "@/lib/utils";
import { UserSortField } from "@/schemas/admin-user-schemas";
import { trpc } from "@/trpc/client";

const DEFAULT_SORTING: SortingState = [{ id: "name", desc: false }];

type User = NonNullable<
	Awaited<ReturnType<typeof authClient.admin.listUsers>>["data"]
>["users"][number];

const roleTypes: Record<string, string> = {
	user: "User",
	admin: "Admin",
};

const verificationStatuses = {
	verified: {
		label: "Verified",
		icon: <CheckIcon className="size-3.5" />,
		bgColor: "bg-green-100 dark:bg-green-900",
	},
	pending: {
		label: "Pending",
		icon: <ClockIcon className="size-3.5" />,
		bgColor: "bg-yellow-100 dark:bg-yellow-900",
	},
};

export function UsersTable(): React.JSX.Element {
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

	const [roleFilter, setRoleFilter] = useQueryState(
		"role",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [emailVerifiedFilter, setEmailVerifiedFilter] = useQueryState(
		"emailVerified",
		parseAsArrayOf(parseAsString).withDefault([]).withOptions({
			shallow: true,
		}),
	);

	const [bannedFilter, setBannedFilter] = useQueryState(
		"banned",
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
		if (roleFilter && roleFilter.length > 0) {
			filters.push({ id: "role", value: roleFilter });
		}
		if (emailVerifiedFilter && emailVerifiedFilter.length > 0) {
			filters.push({ id: "emailVerified", value: emailVerifiedFilter });
		}
		if (bannedFilter && bannedFilter.length > 0) {
			filters.push({ id: "banned", value: bannedFilter });
		}
		if (createdAtFilter && createdAtFilter.length > 0) {
			filters.push({ id: "createdAt", value: createdAtFilter });
		}
		return filters;
	}, [roleFilter, emailVerifiedFilter, bannedFilter, createdAtFilter]);

	const handleFiltersChange = (filters: ColumnFiltersState): void => {
		const getFilterValue = (id: string): string[] => {
			const filter = filters.find((f) => f.id === id);
			return Array.isArray(filter?.value) ? (filter.value as string[]) : [];
		};

		setRoleFilter(getFilterValue("role"));
		setEmailVerifiedFilter(getFilterValue("emailVerified"));
		setBannedFilter(getFilterValue("banned"));
		setCreatedAtFilter(getFilterValue("createdAt"));

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
		const sortBy = UserSortField.options.includes(
			currentSort.id as UserSortField,
		)
			? (currentSort.id as UserSortField)
			: "name";
		const sortOrder = currentSort.desc ? ("desc" as const) : ("asc" as const);
		return { sortBy, sortOrder };
	}, [sorting]);

	const { data, isPending } = trpc.admin.user.list.useQuery(
		{
			limit: pageSize || appConfig.pagination.defaultLimit,
			offset:
				(pageIndex || 0) * (pageSize || appConfig.pagination.defaultLimit),
			query: searchQuery || "",
			sortBy: sortParams.sortBy,
			sortOrder: sortParams.sortOrder,
			filters: {
				role: (roleFilter || []) as ("admin" | "user")[],
				emailVerified: (emailVerifiedFilter || []) as (
					| "pending"
					| "verified"
				)[],
				banned: (bannedFilter || []) as ("active" | "banned")[],
				createdAt: (createdAtFilter || []) as (
					| "today"
					| "this-week"
					| "this-month"
					| "older"
				)[],
			},
		},
		{
			placeholderData: (prev) => prev,
		},
	);

	const { rowSelection, setRowSelection } = useTableSelection({
		total: data?.total,
		pageIndex,
		pageSize,
		setPageIndex,
	});

	const impersonateUser = async (
		userId: string,
		{ name }: { name: string },
	) => {
		const toastId = toast.loading(`Impersonating as ${name}...`);

		try {
			const { error } = await authClient.admin.impersonateUser({ userId });
			if (error) {
				throw error;
			}
			toast.dismiss(toastId);
			toast.success(`Now impersonating ${name}`);
			window.location.href = new URL(
				"/dashboard",
				window.location.origin,
			).toString();
		} catch (_error) {
			toast.dismiss(toastId);
			toast.error("Failed to impersonate user");
		}
	};

	const deleteUser = (id: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.admin.removeUser({ userId: id });
				if (error) {
					throw error;
				}
				await utils.admin.user.list.invalidate();
			},
			{
				loading: "Deleting user...",
				success: "User deleted.",
				error: "User could not be deleted.",
			},
		);
	};

	const resendVerificationMail = (email: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.sendVerificationEmail({ email });
				if (error) {
					throw error;
				}
			},
			{
				loading: "Sending verification email...",
				success: "Verification email sent.",
				error: "Failed to send verification email.",
			},
		);
	};

	const assignAdminRole = async (id: string) => {
		await authClient.admin.setRole({ userId: id, role: "admin" });
		await utils.admin.user.list.invalidate();
	};

	const removeAdminRole = async (id: string) => {
		await authClient.admin.setRole({ userId: id, role: "user" });
		await utils.admin.user.list.invalidate();
	};

	const unbanUserMutation = trpc.admin.user.unbanUser.useMutation({
		onSuccess: () => {
			utils.admin.user.list.invalidate();
		},
	});

	const unbanUser = (id: string) => {
		toast.promise(
			async () => {
				await unbanUserMutation.mutateAsync({ userId: id });
			},
			{
				loading: "Unbanning user...",
				success: "User unbanned.",
				error: "Failed to unban user.",
			},
		);
	};

	const handleSearchQueryChange = (value: string): void => {
		if (value !== searchQuery) {
			setSearchQuery(value);
			if (pageIndex !== 0) {
				setPageIndex(0);
			}
		}
	};

	const columns: ColumnDef<User>[] = [
		createSelectionColumn<User>(),
		{
			accessorKey: "name",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => (
				<div className="flex items-center gap-2 py-2">
					<UserAvatar
						className="size-6"
						name={row.original.name ?? row.original.email}
						src={row.original.image}
					/>
					<div className="font-medium text-foreground">
						{row.original.name ?? "—"}
					</div>
				</div>
			),
		},
		{
			accessorKey: "email",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Email" />
			),
			cell: ({ row }) => (
				<div className="text-foreground/80">{row.original.email}</div>
			),
		},
		{
			accessorKey: "role",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Role" />
			),
			cell: ({ row }) => (
				<div className="text-foreground/80">
					{capitalize(row.original.role)}
				</div>
			),
			filterFn: (row, id, value) => {
				return value.includes(row.getValue(id));
			},
		},
		{
			accessorKey: "emailVerified",
			enableSorting: false,
			header: () => (
				<div className="font-medium text-foreground text-xs">Email Status</div>
			),
			cell: ({ row }) => {
				const status = row.original.emailVerified
					? verificationStatuses.verified
					: verificationStatuses.pending;

				return (
					<Badge
						className={cn(
							"flex items-center justify-center gap-1.5 border-none px-2 py-0.5 font-medium text-foreground text-xs shadow-none",
							status.bgColor,
						)}
						variant="outline"
					>
						{status.icon}
						<span>{status.label}</span>
					</Badge>
				);
			},
			filterFn: (row, _id, value) => {
				const verified = row.original.emailVerified;
				return value.includes(verified ? "verified" : "pending");
			},
		},
		{
			accessorKey: "banned",
			enableSorting: false,
			header: () => (
				<div className="font-medium text-foreground text-xs">
					Account Status
				</div>
			),
			cell: ({ row }) => {
				if (row.original.banned) {
					const banExpires = row.original.banExpires;
					const expiryText = banExpires
						? ` until ${format(new Date(banExpires), "MMM d")}`
						: "";

					return (
						<Badge
							className="flex items-center justify-center gap-1.5 border-none bg-red-100 px-2 py-0.5 font-medium text-foreground text-xs shadow-none dark:bg-red-900"
							variant="outline"
						>
							<BanIcon className="size-3.5" />
							<span>Banned{expiryText}</span>
							{row.original.banReason && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-flex">
											<NotepadTextIcon className="size-3.5" />
										</span>
									</TooltipTrigger>
									<TooltipContent>
										<p className="max-w-xs">{row.original.banReason}</p>
									</TooltipContent>
								</Tooltip>
							)}
						</Badge>
					);
				}
				return (
					<Badge
						className="flex items-center justify-center gap-1.5 border-none bg-green-100 px-2 py-0.5 font-medium text-foreground text-xs shadow-none dark:bg-green-900"
						variant="outline"
					>
						<CheckIcon className="size-3.5" />
						<span>Active</span>
					</Badge>
				);
			},
			filterFn: (row, _id, value) => {
				const banned = row.original.banned;
				return value.includes(banned ? "banned" : "active");
			},
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => (
				<SortableColumnHeader column={column} title="Created" />
			),
			cell: ({ row }) => (
				<div className="text-foreground/80">
					{format(row.original.createdAt, "dd MMM, yyyy")}
				</div>
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
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem
								onClick={() =>
									impersonateUser(row.original.id, {
										name: row.original.name ?? "",
									})
								}
								disabled={row.original.role === "admin"}
								title={
									row.original.role === "admin"
										? "Cannot impersonate other admins"
										: undefined
								}
							>
								Impersonate
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={row.original.emailVerified}
								onClick={() => resendVerificationMail(row.original.email)}
							>
								Resend verification
							</DropdownMenuItem>
							{row.original.role !== "admin" ? (
								<DropdownMenuItem
									onClick={() => assignAdminRole(row.original.id)}
									disabled={row.original.banned}
								>
									Make admin
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem
									onClick={() => removeAdminRole(row.original.id)}
								>
									Remove admin
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							{!row.original.banned ? (
								<DropdownMenuItem
									onClick={() => {
										NiceModal.show(BanUserModal, {
											userId: row.original.id,
											userName: row.original.name || row.original.email,
										});
									}}
								>
									Ban user
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onClick={() => unbanUser(row.original.id)}>
									Unban user
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									NiceModal.show(ConfirmationModal, {
										title: "Delete user?",
										message:
											"Are you sure you want to delete this user? This action cannot be undone.",
										confirmLabel: "Delete",
										destructive: true,
										onConfirm: () => deleteUser(row.original.id),
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

	const userFilters: FilterConfig[] = [
		{
			key: "role",
			title: "Role",
			options: Object.entries(roleTypes).map(([key, label]) => ({
				value: key,
				label,
			})),
		},
		{
			key: "emailVerified",
			title: "Email Status",
			options: [
				{ value: "verified", label: "Verified" },
				{ value: "pending", label: "Pending" },
			],
		},
		{
			key: "banned",
			title: "Account Status",
			options: [
				{ value: "active", label: "Active" },
				{ value: "banned", label: "Banned" },
			],
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
		<TooltipProvider>
			<DataTable
				columnFilters={columnFilters}
				columns={columns}
				data={data?.users || []}
				defaultSorting={DEFAULT_SORTING}
				emptyMessage="No users found."
				enableFilters
				enablePagination
				enableRowSelection
				enableSearch
				filters={userFilters}
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
					<UserBulkActions rowSelection={rowSelection} />
				)}
				rowSelection={rowSelection}
				searchPlaceholder="Search users..."
				searchQuery={searchQuery || ""}
				sorting={sorting}
				totalCount={data?.total ?? 0}
			/>
		</TooltipProvider>
	);
}
