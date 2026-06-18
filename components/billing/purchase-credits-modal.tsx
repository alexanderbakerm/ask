"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { formatCurrency } from "@/lib/billing/utils";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type PurchaseCreditsModalProps = NiceModalHocProps;

export const PurchaseCreditsModal = NiceModal.create<PurchaseCreditsModalProps>(
	() => {
		const modal = useEnhancedModal();
		const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

		const {
			data: packages,
			isLoading: packagesLoading,
			isError: packagesError,
		} = trpc.organization.credit.getPackages.useQuery();

		const purchaseMutation =
			trpc.organization.credit.purchaseCredits.useMutation({
				onSuccess: (data) => {
					if (data.url) {
						window.location.href = data.url;
					}
				},
				onError: (error) => {
					toast.error(error.message);
					setSelectedPackage(null);
				},
			});

		const handlePurchase = (packageId: string) => {
			setSelectedPackage(packageId);
			purchaseMutation.mutate({ packageId });
		};

		return (
			<Dialog open={modal.visible} onOpenChange={modal.handleOpenChange}>
				<DialogContent
					className="max-w-2xl"
					onAnimationEndCapture={modal.handleAnimationEndCapture}
					onClose={modal.handleClose}
				>
					<DialogHeader>
						<DialogTitle>Buy Credits</DialogTitle>
						<DialogDescription>
							Choose a credit package that fits your needs
						</DialogDescription>
					</DialogHeader>

					{packagesError ? (
						<Alert variant="destructive">
							<AlertCircleIcon className="h-4 w-4" />
							<AlertTitle>Failed to load packages</AlertTitle>
							<AlertDescription>
								Unable to fetch credit packages. Please try again.
							</AlertDescription>
						</Alert>
					) : packagesLoading ? (
						<div className="space-y-4 py-4">
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : packages && packages.length > 0 ? (
						<div className="grid gap-4 py-4">
							{packages.map((pkg) => (
								<div
									key={pkg.id}
									className={cn(
										"relative cursor-pointer rounded-lg border bg-neutral-50 p-4 transition-colors hover:border-primary dark:bg-neutral-950",

										purchaseMutation.isPending &&
											selectedPackage === pkg.id &&
											"opacity-70",
									)}
									onClick={() => {
										if (!purchaseMutation.isPending) {
											handlePurchase(pkg.id);
										}
									}}
									onKeyDown={(e) => {
										if (
											(e.key === "Enter" || e.key === " ") &&
											!purchaseMutation.isPending
										) {
											handlePurchase(pkg.id);
										}
									}}
									role="button"
									tabIndex={0}
								>
									{pkg.popular && (
										<span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full bg-linear-to-br from-purple-400 to-amber-300 px-3 py-1 font-medium text-amber-950 text-xs ring-1 ring-white/20 ring-inset ring-offset-1 ring-offset-gray-950/5">
											Popular
										</span>
									)}
									<div className="flex items-center justify-between">
										<div>
											<h3 className="font-medium text-sm">{pkg.name}</h3>
											<p className="text-muted-foreground text-xs">
												{pkg.description}
											</p>
											<div className="mt-1.5">
												<span className="font-semibold text-lg">
													{pkg.totalCredits.toLocaleString()}
												</span>
												<span className="text-muted-foreground text-sm">
													{" "}
													credits
												</span>
												{pkg.bonusCredits > 0 && (
													<span className="ml-2 text-green-600 text-xs">
														(+{pkg.bonusCredits.toLocaleString()} bonus)
													</span>
												)}
											</div>
										</div>
										<div className="text-right">
											<div className="font-semibold text-lg">
												{formatCurrency(pkg.priceAmount, pkg.currency)}
											</div>
											<Button
												size="sm"
												className="mt-1.5"
												disabled={purchaseMutation.isPending}
											>
												{purchaseMutation.isPending &&
												selectedPackage === pkg.id
													? "Processing..."
													: "Buy Now"}
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No credit packages available
						</p>
					)}
				</DialogContent>
			</Dialog>
		);
	},
);
