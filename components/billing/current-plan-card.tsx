"use client";

import { format } from "date-fns";
import { AlertCircle, CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SubscriptionStatusBadge } from "@/components/billing/subscription-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";

interface CurrentPlanCardProps {
	isAdmin?: boolean;
	onUpgrade?: () => void;
	onManageBilling?: () => void;
}

export function CurrentPlanCard({
	isAdmin = false,
	onUpgrade,
	onManageBilling,
}: CurrentPlanCardProps) {
	const {
		data: billingStatus,
		isLoading,
		isError,
	} = trpc.organization.subscription.getStatus.useQuery();

	const createPortalSession =
		trpc.organization.subscription.createPortalSession.useMutation({
			onSuccess: (data) => {
				window.location.href = data.url;
			},
			onError: (error) => {
				toast.error(error.message || "Failed to open billing portal");
			},
		});

	if (isLoading) {
		return <CurrentPlanCardSkeleton />;
	}

	if (isError || !billingStatus?.enabled) {
		return null;
	}

	const { activePlan, subscription } = billingStatus;
	const isFreePlan = activePlan?.planId === "free";
	const isCanceling = subscription?.cancelAtPeriodEnd;
	const isTrialing = activePlan?.isTrialing;
	const isPastDue = subscription?.status === "past_due";
	const isUnpaid = subscription?.status === "unpaid";
	const hasPaymentIssue = isPastDue || isUnpaid;

	const handleManageBilling = () => {
		if (onManageBilling) {
			onManageBilling();
		} else {
			createPortalSession.mutate({});
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="h-5 w-5" />
							Current Plan
						</CardTitle>
						<CardDescription>
							Manage your subscription and billing
						</CardDescription>
					</div>
					{subscription && (
						<SubscriptionStatusBadge status={subscription.status} />
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Plan Info */}
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div>
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-lg">{activePlan?.planName}</h3>
							{activePlan?.isLifetime && (
								<span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs">
									Lifetime
								</span>
							)}
						</div>
						{isFreePlan && (
							<p className="text-muted-foreground text-sm">
								Upgrade to unlock more features
							</p>
						)}
						{isTrialing && subscription?.trialEnd && (
							<p className="text-muted-foreground text-sm">
								Trial ends {format(new Date(subscription.trialEnd), "PPP")}
							</p>
						)}
						{!isFreePlan &&
							!activePlan?.isLifetime &&
							subscription?.currentPeriodEnd && (
								<p className="text-muted-foreground text-sm">
									{isCanceling ? "Access until" : "Renews"}{" "}
									{format(new Date(subscription.currentPeriodEnd), "PPP")}
								</p>
							)}
					</div>
					{!isFreePlan && !activePlan?.isLifetime && isAdmin && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleManageBilling}
							loading={createPortalSession.isPending}
						>
							Manage
						</Button>
					)}
				</div>

				{/* Payment Issue Warning */}
				{hasPaymentIssue && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							{isPastDue ? (
								<>
									<strong>Payment past due.</strong> Your last payment failed.
									Please update your payment method to avoid service
									interruption.
								</>
							) : (
								<>
									<strong>Payment required.</strong> Your subscription is
									unpaid. Please update your payment method to restore access.
								</>
							)}
							{isAdmin && (
								<Button
									variant="link"
									size="sm"
									className="ml-1 h-auto p-0 text-destructive-foreground underline"
									onClick={handleManageBilling}
								>
									Update payment method
								</Button>
							)}
						</AlertDescription>
					</Alert>
				)}

				{/* Cancellation Warning */}
				{isCanceling && !hasPaymentIssue && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Your subscription is set to cancel at the end of the current
							billing period. You'll lose access to premium features after{" "}
							{subscription?.currentPeriodEnd &&
								format(new Date(subscription.currentPeriodEnd), "PPP")}
							.
						</AlertDescription>
					</Alert>
				)}

				{/* Features */}
				{activePlan?.features && activePlan.features.length > 0 && (
					<div>
						<h4 className="mb-2 font-medium text-sm">Included features</h4>
						<ul className="space-y-1.5">
							{activePlan.features.slice(0, 4).map((feature) => (
								<li
									key={feature}
									className="flex items-center gap-2 text-muted-foreground text-sm"
								>
									<CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
									{feature}
								</li>
							))}
							{activePlan.features.length > 4 && (
								<li className="pl-6 text-muted-foreground text-sm">
									+{activePlan.features.length - 4} more features
								</li>
							)}
						</ul>
					</div>
				)}
			</CardContent>
			{isFreePlan && (
				<CardFooter>
					<Button className="w-full" onClick={onUpgrade}>
						<Sparkles className="mr-2 h-4 w-4" />
						Upgrade
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}

function CurrentPlanCardSkeleton() {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-48" />
					</div>
					<Skeleton className="h-6 w-16" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg border p-4">
					<div className="flex items-center justify-between">
						<div className="space-y-2">
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-4 w-36" />
						</div>
						<Skeleton className="h-9 w-20" />
					</div>
				</div>
				<div className="space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</CardContent>
		</Card>
	);
}
