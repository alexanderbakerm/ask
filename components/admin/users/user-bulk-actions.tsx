"use client";

import NiceModal from "@ebay/nice-modal-react";
import type * as React from "react";
import { toast } from "sonner";
import {
	CsvDelimiterModal,
	type DelimiterType,
} from "@/components/csv-delimiter-modal";
import {
	type BulkActionItem,
	DataTableBulkActions,
	getSelectedRowIds,
} from "@/components/ui/custom/data-table";
import { downloadCsv, downloadExcel } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type UserBulkActionsProps = {
	rowSelection: Record<string, boolean>;
};

export function UserBulkActions({
	rowSelection,
}: UserBulkActionsProps): React.JSX.Element {
	const exportCsv = trpc.admin.user.exportSelectedToCsv.useMutation();
	const exportExcel = trpc.admin.user.exportSelectedToExcel.useMutation();

	const getDelimiterChar = (delimiterType: DelimiterType): string => {
		switch (delimiterType) {
			case "comma":
				return ",";
			case "semicolon":
				return ";";
			case "tab":
				return "\t";
			default:
				return ",";
		}
	};

	const handleExportSelectedToCsv = async (delimiter: DelimiterType) => {
		const userIds = getSelectedRowIds(rowSelection);
		if (userIds.length === 0) {
			toast.error("No users selected.");
			return;
		}
		try {
			const csv = await exportCsv.mutateAsync({ userIds });
			const delimiterChar = getDelimiterChar(delimiter);
			const csvData =
				delimiter === "comma" ? csv : csv.replace(/,/g, delimiterChar);
			downloadCsv(csvData, "users.csv");
			toast.success("CSV exported.");
		} catch (_err) {
			toast.error("Failed to export CSV.");
		}
	};

	const handleExportSelectedToExcel = async () => {
		const userIds = getSelectedRowIds(rowSelection);
		if (userIds.length === 0) {
			toast.error("No users selected.");
			return;
		}
		try {
			const base64 = await exportExcel.mutateAsync({ userIds });
			downloadExcel(base64, "users.xlsx");
			toast.success("Excel exported.");
		} catch (_err) {
			toast.error("Failed to export Excel.");
		}
	};

	const actions: BulkActionItem[] = [
		{
			label: "Export to CSV",
			onClick: () => {
				NiceModal.show(CsvDelimiterModal, {
					onConfirm: handleExportSelectedToCsv,
				});
			},
		},
		{
			label: "Export to Excel",
			onClick: handleExportSelectedToExcel,
		},
	];

	return <DataTableBulkActions actions={actions} rowSelection={rowSelection} />;
}
