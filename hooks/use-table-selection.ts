import * as React from "react";
import { appConfig } from "@/config/app.config";

interface UseTableSelectionOptions {
	/** Total count of items across all pages */
	total: number | undefined;
	/** Current page index (0-based) */
	pageIndex: number | null;
	/** Page size */
	pageSize: number | null;
	/** Callback to update page index */
	setPageIndex: (index: number) => void;
}

interface UseTableSelectionReturn {
	rowSelection: Record<string, boolean>;
	setRowSelection: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	clearSelection: () => void;
	removeFromSelection: (ids: string[]) => void;
}

/**
 * Hook for managing table row selection with multi-page support.
 * Handles:
 * - Pagination adjustment when current page is out of bounds
 * - Helper functions for selection management
 */
export function useTableSelection({
	total,
	pageIndex,
	pageSize,
	setPageIndex,
}: UseTableSelectionOptions): UseTableSelectionReturn {
	const [rowSelection, setRowSelection] = React.useState<
		Record<string, boolean>
	>({});

	// Adjust page index if current page is out of bounds after data changes
	React.useEffect(() => {
		if (total == null || pageIndex == null || pageIndex === 0) return;

		const effectivePageSize = pageSize || appConfig.pagination.defaultLimit;
		const totalPages = Math.ceil(total / effectivePageSize);

		if (totalPages === 0) {
			setPageIndex(0);
		} else if (pageIndex >= totalPages) {
			setPageIndex(totalPages - 1);
		}
	}, [total, pageIndex, pageSize, setPageIndex]);

	const clearSelection = React.useCallback(() => {
		setRowSelection({});
	}, []);

	const removeFromSelection = React.useCallback((ids: string[]) => {
		setRowSelection((prev) => {
			const next = { ...prev };
			for (const id of ids) {
				delete next[id];
			}
			return next;
		});
	}, []);

	return {
		rowSelection,
		setRowSelection,
		clearSelection,
		removeFromSelection,
	};
}
