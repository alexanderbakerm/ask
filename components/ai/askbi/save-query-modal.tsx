"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import type { AskBiAnswer } from "@/lib/ai/askbi/viz/spec";
import { trpc } from "@/trpc/client";

export type SaveQueryModalProps = NiceModalHocProps & {
	dataSourceId: string;
	question: string;
	answer: AskBiAnswer;
};

export const SaveQueryModal = NiceModal.create<SaveQueryModalProps>(
	({ dataSourceId, question, answer }) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const [name, setName] = useState(
			(question || answer.primary.title).slice(0, 120),
		);

		const save = trpc.organization.savedQuery.save.useMutation({
			onSuccess: () => {
				toast.success("Query saved");
				utils.organization.savedQuery.list.invalidate();
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message || "Failed to save query"),
		});

		const onSubmit = (e: React.FormEvent) => {
			e.preventDefault();
			if (!name.trim()) return;
			save.mutate({
				name: name.trim(),
				dataSourceId,
				question,
				sql: answer.primary.meta.sql,
				intent: answer.intent,
				vizType: answer.primary.type,
				columns: answer.primary.columns,
			});
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && modal.handleClose()}
			>
				<DialogContent onAnimationEndCapture={modal.handleAnimationEndCapture}>
					<DialogHeader>
						<DialogTitle>Save query</DialogTitle>
						<DialogDescription>
							Saved queries store the SQL and re-run for fresh data when you
							open them.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={onSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="saved-query-name">Name</Label>
							<Input
								id="saved-query-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								autoFocus
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={modal.handleClose}
								disabled={save.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={!name.trim()}
								loading={save.isPending}
							>
								Save
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		);
	},
);
