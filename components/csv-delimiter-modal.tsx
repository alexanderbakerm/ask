"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

export type DelimiterType = "comma" | "semicolon" | "tab";

export type CsvDelimiterModalProps = NiceModalHocProps & {
	onConfirm: (delimiter: DelimiterType) => void;
	title?: string;
	description?: string;
	actionText?: string;
};

export const CsvDelimiterModal = NiceModal.create<CsvDelimiterModalProps>(
	({
		onConfirm,
		title = "Export to CSV",
		description = "Choose the delimiter for your CSV export",
		actionText = "Export",
	}) => {
		const modal = useEnhancedModal();
		const [delimiter, setDelimiter] = React.useState<DelimiterType>("comma");

		const handleConfirm = () => {
			onConfirm(delimiter);
			modal.hide();
		};

		return (
			<Dialog open={modal.visible} onOpenChange={modal.handleOpenChange}>
				<DialogContent
					className="sm:max-w-[425px]"
					onAnimationEndCapture={modal.handleAnimationEndCapture}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<RadioGroup
							value={delimiter}
							onValueChange={(value) => setDelimiter(value as DelimiterType)}
						>
							<div className="mb-2 flex items-center space-x-2">
								<RadioGroupItem value="comma" id="comma" />
								<Label htmlFor="comma" className="cursor-pointer">
									Comma (,)
								</Label>
							</div>
							<div className="mb-2 flex items-center space-x-2">
								<RadioGroupItem value="semicolon" id="semicolon" />
								<Label htmlFor="semicolon" className="cursor-pointer">
									Semicolon (;)
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="tab" id="tab" />
								<Label htmlFor="tab" className="cursor-pointer">
									Tab
								</Label>
							</div>
						</RadioGroup>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => modal.hide()}
						>
							Cancel
						</Button>
						<Button onClick={handleConfirm}>{actionText}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);
