"use client";

import NiceModal from "@ebay/nice-modal-react";
import type * as React from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import {
	CsvDelimiterModal,
	type DelimiterType,
} from "@/components/csv-delimiter-modal";
import {
	type BulkActionItem,
	DataTableBulkActions,
	getSelectedRowIds,
} from "@/components/ui/custom/data-table";
import type { LeadStatus } from "@/lib/db/schema/enums";
import { LeadStatuses } from "@/lib/db/schema/enums";
import { capitalize, downloadCsv, downloadExcel } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type LeadsBulkActionsProps = {
	rowSelection: Record<string, boolean>;
	onClearSelection: () => void;
};

const statusLabels: Record<string, string> = {
	new: "New",
	contacted: "Contacted",
	qualified: "Qualified",
	proposal: "Proposal",
	negotiation: "Negotiation",
	won: "Won",
	lost: "Lost",
};

export function LeadsBulkActions({
	rowSelection,
	onClearSelection,
}: LeadsBulkActionsProps): React.JSX.Element {
	const utils = trpc.useUtils();

	const exportCsv = trpc.organization.lead.exportSelectedToCsv.useMutation();
	const exportExcel =
		trpc.organization.lead.exportSelectedToExcel.useMutation();
	const bulkDelete = trpc.organization.lead.bulkDelete.useMutation();
	const bulkUpdateStatus =
		trpc.organization.lead.bulkUpdateStatus.useMutation();

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
		const leadIds = getSelectedRowIds(rowSelection);
		if (leadIds.length === 0) {
			toast.error("No leads selected.");
			return;
		}
		try {
			const csv = await exportCsv.mutateAsync({ leadIds });
			const delimiterChar = getDelimiterChar(delimiter);
			const csvData =
				delimiter === "comma" ? csv : csv.replace(/,/g, delimiterChar);
			downloadCsv(csvData, "leads.csv");
			toast.success("CSV exported.");
		} catch (_err) {
			toast.error("Failed to export CSV.");
		}
	};

	const handleExportSelectedToExcel = async () => {
		const leadIds = getSelectedRowIds(rowSelection);
		if (leadIds.length === 0) {
			toast.error("No leads selected.");
			return;
		}
		try {
			const base64 = await exportExcel.mutateAsync({ leadIds });
			downloadExcel(base64, "leads.xlsx");
			toast.success("Excel exported.");
		} catch (_err) {
			toast.error("Failed to export Excel.");
		}
	};

	const handleBulkDelete = () => {
		const ids = getSelectedRowIds(rowSelection);
		if (ids.length === 0) {
			toast.error("No leads selected.");
			return;
		}

		NiceModal.show(ConfirmationModal, {
			title: "Delete leads?",
			message: `Are you sure you want to delete ${ids.length} lead${ids.length > 1 ? "s" : ""}? This action cannot be undone.`,
			confirmLabel: "Delete",
			destructive: true,
			onConfirm: async () => {
				try {
					await bulkDelete.mutateAsync({ ids });
					toast.success(
						`${ids.length} lead${ids.length > 1 ? "s" : ""} deleted.`,
					);
					onClearSelection();
					utils.organization.lead.list.invalidate();
				} catch (_err) {
					toast.error("Failed to delete leads.");
				}
			},
		});
	};

	const handleBulkUpdateStatus = async (status: LeadStatus) => {
		const ids = getSelectedRowIds(rowSelection);
		if (ids.length === 0) {
			toast.error("No leads selected.");
			return;
		}

		try {
			await bulkUpdateStatus.mutateAsync({ ids, status });
			toast.success(
				`${ids.length} lead${ids.length > 1 ? "s" : ""} updated to ${statusLabels[status] || capitalize(status)}.`,
			);
			onClearSelection();
			utils.organization.lead.list.invalidate();
		} catch (_err) {
			toast.error("Failed to update leads.");
		}
	};

	const statusActions: BulkActionItem[] = LeadStatuses.map((status) => ({
		label: `Set to ${statusLabels[status] || capitalize(status)}`,
		onClick: () => handleBulkUpdateStatus(status as LeadStatus),
	}));

	const actions: BulkActionItem[] = [
		{
			label: "Change status",
			actions: statusActions,
		},
		{
			label: "Export to CSV",
			separator: true,
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
		{
			label: "Delete",
			onClick: handleBulkDelete,
			variant: "destructive",
			separator: true,
		},
	];

	return <DataTableBulkActions actions={actions} rowSelection={rowSelection} />;
}
