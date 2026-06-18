"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PricingTable } from "@/components/billing/pricing-table";
import { appConfig } from "@/config/app.config";
import {
	calculateYearlySavingsPercent,
	getPlansForPricingTable,
} from "@/lib/billing/utils";
import { trpc } from "@/trpc/client";

interface PlanSelectionProps {
	className?: string;
}

/**
 * Plan selection component for the choose-plan page.
 * Displays available plans and handles checkout flow.
 */
export function PlanSelection({ className }: PlanSelectionProps) {
	const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

	// Memoize static config-based computations
	const plans = useMemo(() => getPlansForPricingTable(), []);
	const yearlySavingsPercent = useMemo(
		() => calculateYearlySavingsPercent(),
		[],
	);

	const createCheckout =
		trpc.organization.subscription.createCheckout.useMutation({
			onSuccess: (data) => {
				if (data.url) {
					window.location.href = data.url;
				} else {
					// No URL returned - something went wrong
					console.error("Checkout session created but no URL returned");
					toast.error("Failed to create checkout session. Please try again.");
					setLoadingPriceId(null);
				}
			},
			onError: (error) => {
				console.error("Checkout error:", error);
				toast.error(error.message || "Failed to create checkout session");
				setLoadingPriceId(null);
			},
		});

	const handleSelectPlan = (stripePriceId: string) => {
		// Prevent double-clicks
		if (createCheckout.isPending || loadingPriceId) {
			return;
		}

		setLoadingPriceId(stripePriceId);
		createCheckout.mutate({
			priceId: stripePriceId,
			successUrl: `${appConfig.baseUrl}/dashboard/organization?checkout=success`,
			cancelUrl: `${appConfig.baseUrl}/dashboard/choose-plan?checkout=cancelled`,
		});
	};

	return (
		<PricingTable
			className={className}
			plans={plans}
			onSelectPlan={handleSelectPlan}
			loadingPriceId={loadingPriceId}
			showFreePlans={false}
			showEnterprisePlans={true}
			yearlySavingsPercent={yearlySavingsPercent}
			enterpriseContactEmail={appConfig.contact.email}
		/>
	);
}
