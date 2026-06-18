"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import * as React from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputPassword } from "@/components/ui/custom/input-password";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";

export type TwoFactorModalProps = NiceModalHocProps;

export const TwoFactorModal = NiceModal.create<TwoFactorModalProps>(() => {
	const modal = useEnhancedModal();
	const { user, reloadSession } = useSession();

	const [view, setDialogView] = React.useState<"password" | "totp-url">(
		"password",
	);
	const [totpURI, setTotpURI] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [totpCode, setTotpCode] = React.useState("");

	const totpURISecret = React.useMemo(() => {
		if (!totpURI) {
			return null;
		}

		const url = new URL(totpURI);
		return url.searchParams.get("secret") || null;
	}, [totpURI]);

	const enableTwoFactorMutation = useMutation({
		mutationKey: ["enableTwoFactor"],
		mutationFn: async () => {
			const { data, error } = await authClient.twoFactor.enable({
				password,
			});

			if (error) {
				throw error;
			}

			setTotpURI(data.totpURI);
			setDialogView("totp-url");
		},

		onError: () => {
			toast.error(
				"Could not verify your account with the provided password. Please try again.",
			);
		},
	});

	const disableTwoFactorMutation = useMutation({
		mutationKey: ["disableTwoFactor"],
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.disable({
				password,
			});

			if (error) {
				throw error;
			}

			modal.handleClose();

			toast.success(
				"Two-factor authentication has been disabled successfully.",
			);

			reloadSession();
		},

		onError: () => {
			toast.error(
				"Could not verify your account with the provided password. Please try again.",
			);
		},
	});

	const verifyTwoFactorMutation = useMutation({
		mutationKey: ["verifyTwoFactor"],
		mutationFn: async () => {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: totpCode,
			});

			if (error) {
				throw error;
			}

			toast.success("Two-factor authentication has been enabled successfully.");

			reloadSession();
			modal.handleClose();
		},
	});

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (user?.twoFactorEnabled) {
			disableTwoFactorMutation.mutate();
			return;
		}

		if (view === "password") {
			enableTwoFactorMutation.mutate();
			return;
		}

		verifyTwoFactorMutation.mutate();
	};
	return (
		<Dialog open={modal.visible}>
			<DialogContent
				className="max-w-md"
				onAnimationEndCapture={modal.handleAnimationEndCapture}
				onClose={modal.handleClose}
			>
				<DialogHeader>
					<DialogTitle>
						{view === "password"
							? "Verify with password"
							: "Enable two-factor authentication"}
					</DialogTitle>
					<DialogDescription>
						{view === "password"
							? "Please verify your account by entering your password."
							: "Use your preferred authenticator app and scan the QR code with it or enter the secret below manually to set up two-factor authentication."}
					</DialogDescription>
				</DialogHeader>
				{view === "password" ? (
					<form onSubmit={handleSubmit}>
						<div className="grid grid-cols-1 gap-4">
							<FormItem>
								<Label className="block">Your password:</Label>
								<InputPassword
									autoComplete="current-password"
									onChange={(e) => setPassword(e.target.value)}
									value={password}
								/>
							</FormItem>
						</div>
						<DialogFooter className="mt-4">
							<Button
								className="w-full"
								loading={
									enableTwoFactorMutation.isPending ||
									disableTwoFactorMutation.isPending
								}
								type="submit"
								variant="secondary"
							>
								Continue
								<ArrowRightIcon className="ml-1.5 size-4" />
							</Button>
						</DialogFooter>
					</form>
				) : (
					<form onSubmit={handleSubmit}>
						<div className="grid grid-cols-1 gap-4">
							<div className="flex flex-col items-center gap-4 px-6">
								<QRCode value={totpURI} />
								{totpURISecret && (
									<p className="text-center text-[10px] text-muted-foreground">
										{totpURISecret}
									</p>
								)}
							</div>
							<div className="grid grid-cols-1 gap-4">
								<FormItem>
									<Label className="block">
										Enter 6-digit code to verify the setup:
									</Label>
									<Input
										autoComplete="one-time-code"
										onChange={(e) => setTotpCode(e.target.value)}
										value={totpCode}
									/>
								</FormItem>
							</div>
						</div>
						<DialogFooter className="mt-4">
							<Button
								loading={verifyTwoFactorMutation.isPending}
								onClick={modal.handleClose}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								loading={verifyTwoFactorMutation.isPending}
								type="submit"
								variant="default"
							>
								Save
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
});
