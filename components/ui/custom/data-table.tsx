"use client";

import {
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
	ChevronsUpDownIcon,
	PlusCircleIcon,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { EmptyText } from "@/components/ui/custom/empty-text";
import { InputSearch } from "@/components/ui/custom/input-search";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	type PopoverContentProps,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface FilterOption {
	value: string;
	label: string;
	icon?: React.ComponentType<{ className?: string }>;
}

export interface FilterConfig {
	key: string;
	title: string;
	options: FilterOption[];
	className?: DataTableFacetedFilterProps["className"];
}

export interface DataTableProps<TData> {
	data: TData[];
	columns: ColumnDef<TData>[];
	searchQuery?: string;
	searchPlaceholder?: string;
	onSearchQueryChange?: (value: string) => void;
	filters?: FilterConfig[];
	columnFilters?: ColumnFiltersState;
	onFiltersChange?: (filters: ColumnFiltersState) => void;
	sorting?: SortingState;
	defaultSorting?: SortingState;
	onSortingChange?: (sorting: SortingState) => void;
	pageSize?: number;
	pageIndex?: number;
	totalCount: number;
	onPageIndexChange?: (pageIndex: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
	rowSelection?: Record<string, boolean>;
	onRowSelectionChange?: (rowSelection: Record<string, boolean>) => void;
	enableRowSelection?: boolean;
	enablePagination?: boolean;
	enableSearch?: boolean;
	enableFilters?: boolean;
	emptyMessage?: string;
	className?: string;
	toolbarActions?: React.ReactNode;
	renderBulkActions?: () => React.ReactNode;
	loading?: boolean;
	onRowClick?: (data: TData, event: React.MouseEvent) => void;
	getExpandedContent?: (row: any) => React.ReactNode;
	/** Custom function to derive row ID from row data. Required for proper multi-page selection. */
	getRowId?: (originalRow: TData, index: number, parent?: any) => string;
}

function DataTableSkeletonRows(columnCount: number, rowCount = 5) {
	return Array.from({ length: rowCount }).map((_, skeletonRowIdx) => (
		<TableRow key={`skeleton-row-${skeletonRowIdx}`}>
			{Array.from({ length: columnCount }).map((__, skeletonColIdx) => (
				<TableCell key={`skeleton-cell-${skeletonRowIdx}-${skeletonColIdx}`}>
					<Skeleton className="h-4 w-full" />
				</TableCell>
			))}
		</TableRow>
	));
}

export function DataTable<TData>({
	data,
	columns,
	searchQuery = "",
	searchPlaceholder = "Filter...",
	onSearchQueryChange,
	filters = [],
	columnFilters = [],
	onFiltersChange,
	sorting: sortingProp,
	defaultSorting = [],
	onSortingChange,
	pageSize = 25,
	pageIndex = 0,
	totalCount,
	onPageIndexChange,
	onPageSizeChange,
	rowSelection = {},
	onRowSelectionChange,
	enableRowSelection = true,
	enablePagination = true,
	enableSearch = true,
	enableFilters = true,
	emptyMessage = "No results.",
	className = "",
	toolbarActions,
	renderBulkActions,
	loading = false,
	onRowClick,
	getExpandedContent,
	getRowId,
}: DataTableProps<TData>) {
	const [mounted, setMounted] = React.useState(false);
	const [internalRowSelection, setInternalRowSelection] = React.useState<
		Record<string, boolean>
	>({});
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [internalColumnFilters, setInternalColumnFilters] =
		React.useState<ColumnFiltersState>([]);
	const [internalSorting, setInternalSorting] =
		React.useState<SortingState>(defaultSorting);
	const [internalPagination, setInternalPagination] = React.useState({
		pageIndex: 0,
		pageSize,
	});

	// Use controlled sorting if provided, otherwise use internal state
	const currentSorting = onSortingChange
		? (sortingProp ?? [])
		: internalSorting;

	React.useEffect(() => {
		setMounted(true);
	}, []);

	const currentRowSelection = onRowSelectionChange
		? rowSelection
		: internalRowSelection;
	const currentPageIndex = onPageIndexChange
		? pageIndex
		: internalPagination.pageIndex;
	const currentColumnFilters = onFiltersChange
		? columnFilters
		: internalColumnFilters;

	const table = useReactTable({
		data,
		columns,
		getRowId,
		state: {
			sorting: currentSorting,
			columnVisibility,
			rowSelection: enableRowSelection ? currentRowSelection : {},
			columnFilters: currentColumnFilters,
			pagination: enablePagination
				? { pageIndex: currentPageIndex, pageSize }
				: undefined,
		},
		enableRowSelection,
		enableGlobalFilter: enableSearch,
		onRowSelectionChange: enableRowSelection
			? (updater) => {
					const newSelection =
						typeof updater === "function"
							? updater(currentRowSelection)
							: updater;
					onRowSelectionChange
						? onRowSelectionChange(newSelection)
						: setInternalRowSelection(newSelection);
				}
			: undefined,
		onSortingChange: (updater) => {
			const newSorting =
				typeof updater === "function" ? updater(currentSorting) : updater;
			onSortingChange
				? onSortingChange(newSorting)
				: setInternalSorting(newSorting);
		},
		onColumnFiltersChange: (updater) => {
			const newFilters =
				typeof updater === "function" ? updater(currentColumnFilters) : updater;
			onFiltersChange
				? onFiltersChange(newFilters)
				: setInternalColumnFilters(newFilters);
		},
		onColumnVisibilityChange: setColumnVisibility,
		onPaginationChange: enablePagination
			? (updater) => {
					const newPagination =
						typeof updater === "function"
							? updater({ pageIndex: currentPageIndex, pageSize })
							: updater;
					if (onPageIndexChange || onPageSizeChange) {
						if (newPagination.pageIndex !== currentPageIndex) {
							onPageIndexChange?.(newPagination.pageIndex);
						}
						if (newPagination.pageSize !== pageSize) {
							onPageSizeChange?.(newPagination.pageSize);
							// Reset to first page when changing page size
							onPageIndexChange?.(0);
						}
					} else {
						setInternalPagination(newPagination);
					}
				}
			: undefined,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: onFiltersChange ? undefined : getFilteredRowModel(),
		getPaginationRowModel: enablePagination
			? getPaginationRowModel()
			: undefined,
		getSortedRowModel: onSortingChange ? undefined : getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		manualSorting: !!onSortingChange,
		manualFiltering: !!onFiltersChange,
		manualPagination: true,
		rowCount: totalCount,
	});

	const handleFilterChange = (filterKey: string, selectedValues: string[]) => {
		// For server-side filtering, we update the columnFilters state directly
		// instead of using table.getColumn() which requires the column to exist
		const newFilters = currentColumnFilters.filter((f) => f.id !== filterKey);
		if (selectedValues.length > 0) {
			newFilters.push({ id: filterKey, value: selectedValues });
		}
		onFiltersChange
			? onFiltersChange(newFilters)
			: setInternalColumnFilters(newFilters);
	};

	// Helper to get filter value from columnFilters state
	const getFilterValue = (filterKey: string): string[] => {
		const filter = currentColumnFilters.find((f) => f.id === filterKey);
		return Array.isArray(filter?.value) ? (filter.value as string[]) : [];
	};

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* Bulk Actions - Floating bar at bottom (positioned via CSS) */}
			{typeof renderBulkActions === "function" && renderBulkActions()}

			{/* Toolbar */}
			{(enableFilters || enableSearch || toolbarActions) && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{enableSearch && (
							<InputSearch
								className="h-8 w-[150px] shadow-none lg:w-[250px]"
								onChange={(e) => onSearchQueryChange?.(e.target.value)}
								placeholder={searchPlaceholder}
								value={searchQuery || ""}
								clearButtonProps={{
									className: "flex size-6 [&_svg]:size-3.5",
								}}
							/>
						)}
						{enableFilters &&
							filters.map((filter) => (
								<DataTableFacetedFilter
									className={filter.className}
									key={filter.key}
									onChange={(selectedValues) =>
										handleFilterChange(filter.key, selectedValues)
									}
									options={filter.options}
									selected={getFilterValue(filter.key)}
									title={filter.title}
								/>
							))}
					</div>
					{toolbarActions && (
						<div className="flex items-center gap-2">{toolbarActions}</div>
					)}
				</div>
			)}

			{/* Table */}
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-neutral-50 dark:bg-transparent">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead colSpan={header.colSpan} key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{loading ? (
							DataTableSkeletonRows(columns.length)
						) : table.getRowModel().rows?.length > 0 ? (
							table.getRowModel().rows.map((row) => [
								<TableRow
									className={
										onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined
									}
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									onClick={
										onRowClick
											? (event) => onRowClick(row.original, event)
											: undefined
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>,
								getExpandedContent?.(row) ? (
									<TableRow
										key={`${row.id}-expanded`}
										className="bg-background! hover:bg-background! focus:bg-background! active:bg-background!"
									>
										<TableCell
											colSpan={columns.length}
											className="bg-background! p-0"
										>
											{getExpandedContent(row)}
										</TableCell>
									</TableRow>
								) : null,
							])
						) : (
							<TableRow>
								<TableCell
									className="h-24 text-center"
									colSpan={columns.length}
								>
									<EmptyText>{emptyMessage}</EmptyText>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			{enablePagination && (
				<div className="flex items-center justify-between px-4">
					<div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
						{getSelectedRowIds(currentRowSelection).length} of {totalCount}{" "}
						row(s) selected.
					</div>
					<div className="flex w-full items-center gap-8 lg:w-fit">
						{mounted && (
							<div className="hidden items-center gap-2 lg:flex">
								<p className="font-medium text-sm">Rows per page</p>
								<Select
									value={`${table.getState().pagination.pageSize}`}
									onValueChange={(value) => {
										table.setPageSize(Number(value));
									}}
								>
									<SelectTrigger className="h-8! w-16">
										<SelectValue
											placeholder={table.getState().pagination.pageSize}
										/>
									</SelectTrigger>
									<SelectContent side="top">
										{[10, 20, 25, 30, 40, 50].map((size) => (
											<SelectItem key={size} value={`${size}`}>
												{size}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
						<div className="flex w-fit items-center justify-center font-medium text-sm">
							Page {table.getState().pagination.pageIndex + 1} of{" "}
							{table.getPageCount() || 1}
						</div>
						<div className="ml-auto flex items-center gap-2 lg:ml-0">
							<Button
								variant="outline"
								className="hidden size-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(0)}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to first page</span>
								<ChevronsLeftIcon />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to previous page</span>
								<ChevronLeftIcon />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to next page</span>
								<ChevronRightIcon />
							</Button>
							<Button
								variant="outline"
								className="hidden size-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(table.getPageCount() - 1)}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to last page</span>
								<ChevronsRightIcon />
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export function createSelectionColumn<TData>(): ColumnDef<TData> {
	return {
		id: "select",
		header: ({ table }) => (
			<Checkbox
				aria-label="Select all"
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				aria-label="Select row"
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				onClick={(e) => e.stopPropagation()}
			/>
		),
		enableSorting: false,
		enableHiding: false,
	};
}

export type DataTableFacetedFilterProps = {
	title?: string;
	options: FilterOption[];
	selected: string[];
	onChange: (values: string[]) => void;
	className?: PopoverContentProps["className"];
};

export interface BulkActionItem {
	label: string;
	onClick?: () => void | Promise<void>;
	variant?: "default" | "destructive";
	separator?: boolean;
	actions?: BulkActionItem[];
}

/** Get all selected row IDs from rowSelection state (works across pages) */
export function getSelectedRowIds(
	rowSelection: Record<string, boolean>,
): string[] {
	return Object.keys(rowSelection).filter((key) => rowSelection[key]);
}

export interface DataTableBulkActionsProps {
	actions: BulkActionItem[];
	className?: string;
	rowSelection: Record<string, boolean>;
}

export function DataTableBulkActions({
	actions,
	className,
	rowSelection,
}: DataTableBulkActionsProps) {
	const selectedCount = getSelectedRowIds(rowSelection).length;

	if (selectedCount === 0) {
		return null;
	}

	const renderAction = (action: BulkActionItem, index: number) => {
		if (action.actions && action.actions.length > 0) {
			return (
				<React.Fragment key={`${action.label}-${index}`}>
					{action.separator && index > 0 && <DropdownMenuSeparator />}
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<span>{action.label}</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{action.actions.map((subAction, subIndex) =>
								renderAction(subAction, subIndex),
							)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</React.Fragment>
			);
		}

		return (
			<React.Fragment key={`${action.label}-${index}`}>
				{action.separator && index > 0 && <DropdownMenuSeparator />}
				<DropdownMenuItem
					className={cn(
						"cursor-pointer",
						action.variant === "destructive" &&
							"text-destructive focus:text-destructive",
					)}
					onClick={action.onClick}
				>
					{action.label}
				</DropdownMenuItem>
			</React.Fragment>
		);
	};

	return (
		<div
			className={cn(
				"absolute right-0 bottom-4 left-0 z-50 flex justify-center",
				className,
			)}
		>
			<div className="flex w-full max-w-sm items-center justify-between gap-4 rounded-md border bg-background px-4 py-2.5 shadow-md">
				<span className="font-semibold text-sm">{selectedCount} selected</span>
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							className="text-sm"
							size="default"
							type="button"
							variant="outline"
						>
							Bulk actions
							<ChevronsUpDownIcon className="ml-1 size-4 opacity-50" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{actions.map((action, index) => renderAction(action, index))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function DataTableFacetedFilter({
	title,
	options,
	selected,
	onChange,
	className,
}: DataTableFacetedFilterProps) {
	const [mounted, setMounted] = React.useState(false);
	const selectedValues = new Set(selected);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	// Render a placeholder button during SSR to avoid Radix hydration mismatch
	if (!mounted) {
		return (
			<Button
				variant="outline"
				size="sm"
				className="h-8 justify-start border-dashed"
			>
				<PlusCircleIcon />
				{title}
			</Button>
		);
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-8 justify-start border-dashed"
				>
					<PlusCircleIcon />
					{title}
					{selectedValues?.size > 0 && (
						<>
							<Separator orientation="vertical" className="mx-2 h-4" />
							<Badge
								variant="secondary"
								className="rounded-sm px-1 font-normal lg:hidden"
							>
								{selectedValues.size}
							</Badge>
							<div className="hidden gap-1 lg:flex">
								{selectedValues.size > 2 ? (
									<Badge
										variant="secondary"
										className="rounded-sm px-1 font-normal"
									>
										{selectedValues.size} selected
									</Badge>
								) : (
									options
										.filter((option) => selectedValues.has(option.value))
										.map((option) => (
											<Badge
												variant="secondary"
												key={option.value}
												className="rounded-sm px-1 font-normal"
											>
												{option.label}
											</Badge>
										))
								)}
							</div>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn("min-w-[200px] w-fit max-w-[300px] p-0", className)}
				align="start"
			>
				<Command>
					<CommandInput placeholder={title} />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => {
								const isSelected = selectedValues.has(option.value);
								return (
									<CommandItem
										key={option.value}
										onSelect={() => {
											if (isSelected) {
												selectedValues.delete(option.value);
											} else {
												selectedValues.add(option.value);
											}
											const filterValues = Array.from(selectedValues);
											onChange(filterValues.length ? filterValues : []);
										}}
									>
										<div
											className={cn(
												"flex size-4 items-center justify-center rounded-[4px] border",
												isSelected
													? "border-primary bg-primary text-primary-foreground"
													: "border-input [&_svg]:invisible",
											)}
										>
											<CheckIcon className="size-3.5 text-primary-foreground" />
										</div>
										{option.icon && (
											<option.icon className="size-4 text-muted-foreground" />
										)}
										<span>{option.label}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
						{selectedValues.size > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										onSelect={() => onChange([])}
										className="justify-center text-center"
									>
										Clear filters
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface SortableColumnHeaderProps<TData, TValue>
	extends React.HTMLAttributes<HTMLDivElement> {
	column: Column<TData, TValue>;
	title: string;
}

/**
 * A sortable column header component that cycles through sorting states on click.
 * Click cycle: neutral -> ascending -> descending -> neutral
 */
export function SortableColumnHeader<TData, TValue>({
	column,
	title,
	className,
}: SortableColumnHeaderProps<TData, TValue>): React.JSX.Element {
	if (!column.getCanSort()) {
		return (
			<div className={cn("font-medium text-foreground text-xs", className)}>
				{title}
			</div>
		);
	}

	const handleClick = () => {
		const currentSort = column.getIsSorted();
		if (currentSort === false) {
			// neutral -> ascending
			column.toggleSorting(false);
		} else if (currentSort === "asc") {
			// ascending -> descending
			column.toggleSorting(true);
		} else {
			// descending -> neutral
			column.clearSorting();
		}
	};

	return (
		<button
			type="button"
			className={cn(
				"flex cursor-pointer items-center gap-1 font-medium text-foreground text-xs transition-colors hover:text-foreground/80",
				className,
			)}
			onClick={handleClick}
		>
			{title}
			{column.getIsSorted() === "desc" ? (
				<ArrowDownIcon className="size-3.5" />
			) : column.getIsSorted() === "asc" ? (
				<ArrowUpIcon className="size-3.5" />
			) : (
				<ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
			)}
		</button>
	);
}
