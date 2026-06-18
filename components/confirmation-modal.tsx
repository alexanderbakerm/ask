"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";

export type ConfirmationModalProps = NiceModalHocProps & {
	title: string;
	message?: string;
	cancelLabel?: string;
	confirmLabel?: string;
	destructive?: boolean;
	requiredText?: string;
	onConfirm: () =>
		| boolean
		| undefined
		| void
		| Promise<void>
		| Promise<boolean | undefined>;
};

export const ConfirmationModal = NiceModal.create<ConfirmationModalProps>(
	({
		title,
		message,
		cancelLabel,
		confirmLabel,
		destructive,
		requiredText,
		onConfirm,
	}) => {
		const modal = useEnhancedModal();
		const [textInput, setTextInput] = useState("");
		const [showError, setShowError] = useState(false);

		const isTextValid = !requiredText || textInput === requiredText;

		const handleConfirm = async () => {
			if (!!requiredText && textInput !== requiredText) {
				setShowError(true);
				return;
			}
			try {
				const result = await onConfirm();
				if (result !== false) {
					modal.handleClose();
				}
			} catch (error) {
				console.error("Confirmation modal action failed", error);
				toast.error("Something went wrong. Please try again.");
			}
		};

		const handleTextInputChange = (value: string) => {
			setTextInput(value);
			if (showError) {
				setShowError(false);
			}
		};

		return (
			<AlertDialog open={modal.visible}>
				<AlertDialogContent
					onAnimationEndCapture={modal.handleAnimationEndCapture}
					onClose={modal.handleClose}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>{message}</AlertDialogDescription>

					{!!requiredText && (
						<div className="space-y-2">
							<Label htmlFor="confirmation-input">
								Type <strong>"{requiredText}"</strong> to confirm:
							</Label>
							<Input
								className={showError ? "border-destructive" : ""}
								id="confirmation-input"
								onChange={(e) => handleTextInputChange(e.target.value)}
								type="text"
								value={textInput}
							/>
							{showError && (
								<p className="text-destructive-foreground text-sm">
									Please type "{requiredText}" exactly to confirm.
								</p>
							)}
						</div>
					)}
					<AlertDialogFooter>
						<Button onClick={modal.handleClose} type="button" variant="outline">
							{cancelLabel ?? "Cancel"}
						</Button>
						<Button
							disabled={!isTextValid}
							onClick={handleConfirm}
							type="button"
							variant={destructive ? "destructive" : "default"}
						>
							{confirmLabel ?? "Confirm"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	},
);
