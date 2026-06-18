"use client";

import NiceModal from "@ebay/nice-modal-react";
import { format, isToday, isYesterday } from "date-fns";
import {
	AlertCircleIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	PlusIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PurchaseCreditsModal } from "@/components/billing/purchase-credits-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { EmptyText } from "@/components/ui/custom/empty-text";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditTransactionType } from "@/lib/db/schema/enums";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

// Transaction type display configuration
const transactionTypeConfig: Record<
	string,
	{ label: string; className: string }
> = {
	[CreditTransactionType.purchase]: {
		label: "Purchase",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.subscriptionGrant]: {
		label: "Subscription",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.bonus]: {
		label: "Bonus",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.promo]: {
		label: "Promo",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.usage]: {
		label: "Usage",
		className: "bg-secondary/30 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.refund]: {
		label: "Refund",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.expire]: {
		label: "Expired",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
	[CreditTransactionType.adjustment]: {
		label: "Adjustment",
		className: "bg-secondary/50 text-secondary-foreground border-transparent",
	},
};

const TRANSACTIONS_PER_PAGE = 10;

interface CreditsSettingsTabProps {
	isAdmin: boolean;
}

export function CreditsSettingsTab({ isAdmin }: CreditsSettingsTabProps) {
	const [transactionPage, setTransactionPage] = useState(0);

	const {
		data: balance,
		isLoading: balanceLoading,
		isError: balanceError,
		refetch: refetchBalance,
	} = trpc.organization.credit.getBalance.useQuery();

	const {
		data: transactions,
		isLoading: transactionsLoading,
		isError: transactionsError,
		refetch: refetchTransactions,
	} = trpc.organization.credit.getTransactions.useQuery({
		limit: TRANSACTIONS_PER_PAGE,
		offset: transactionPage * TRANSACTIONS_PER_PAGE,
	});

	const handleNextPage = () => {
		setTransactionPage((p) => p + 1);
	};

	const handlePrevPage = () => {
		setTransactionPage((p) => Math.max(0, p - 1));
	};

	if (balanceLoading) {
		return <CreditsSettingsTabSkeleton />;
	}

	if (balanceError) {
		return (
			<Alert variant="destructive">
				<AlertCircleIcon className="h-4 w-4" />
				<AlertTitle>Failed to load credits</AlertTitle>
				<AlertDescription className="flex items-center justify-between">
					<span>Please try refreshing the page.</span>
					<Button variant="outline" size="sm" onClick={() => refetchBalance()}>
						<RefreshCwIcon className="mr-2 h-4 w-4" />
						Retry
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-6">
			{/* Balance Card */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-start justify-between">
						<div className="space-y-1">
							<CardTitle>Credit Balance</CardTitle>
							<CardDescription>
								Credits are used for AI features like chat and document analysis
							</CardDescription>
						</div>
						{isAdmin && (
							<Button
								onClick={() => NiceModal.show(PurchaseCreditsModal)}
								size="sm"
							>
								<PlusIcon className="size-4 shrink-0" />
								Buy Credits
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Main Balance Display */}
					<div className="flex items-baseline gap-2">
						<span className="font-bold text-4xl tabular-nums">
							{balance?.balance.toLocaleString() ?? 0}
						</span>
						<span className="text-muted-foreground text-sm">
							credits available
						</span>
					</div>

					{/* Stats Grid */}
					<div className="flex flex-wrap gap-x-8 gap-y-2 border-t pt-4">
						<div className="space-y-0.5">
							<p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
								Purchased
							</p>
							<p className="font-semibold tabular-nums text-sm">
								{balance?.lifetimePurchased.toLocaleString() ?? 0}
							</p>
						</div>
						<div className="space-y-0.5">
							<p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
								Bonus
							</p>
							<p className="font-semibold tabular-nums text-sm">
								{balance?.lifetimeGranted.toLocaleString() ?? 0}
							</p>
						</div>
						<div className="space-y-0.5">
							<p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
								Used
							</p>
							<p className="font-semibold tabular-nums text-sm">
								{balance?.lifetimeUsed.toLocaleString() ?? 0}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Transaction History */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Recent Activity</CardTitle>
							<CardDescription>Your credit transaction history</CardDescription>
						</div>
						{transactionPage > 0 && (
							<span className="text-muted-foreground text-sm">
								Page {transactionPage + 1}
							</span>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{transactionsError ? (
						<Alert variant="destructive">
							<AlertCircleIcon className="h-4 w-4" />
							<AlertTitle>Failed to load transactions</AlertTitle>
							<AlertDescription className="flex items-center justify-between">
								<span>Unable to fetch transaction history.</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() => refetchTransactions()}
								>
									<RefreshCwIcon className="mr-2 h-4 w-4" />
									Retry
								</Button>
							</AlertDescription>
						</Alert>
					) : transactionsLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					) : transactions && transactions.transactions.length > 0 ? (
						<>
							<div className="space-y-6">
								{Object.entries(
									transactions.transactions.reduce(
										(acc, tx) => {
											const date = new Date(tx.createdAt);
											let groupKey = format(date, "MMMM d, yyyy");
											if (isToday(date)) groupKey = "Today";
											else if (isYesterday(date)) groupKey = "Yesterday";

											if (!acc[groupKey]) acc[groupKey] = [];
											acc[groupKey]!.push(tx);
											return acc;
										},
										{} as Record<string, typeof transactions.transactions>,
									),
								).map(([group, groupTxs]) => (
									<div key={group} className="space-y-2">
										<h3 className="text-muted-foreground text-xs font-medium px-1">
											{group}
										</h3>
										<div className="divide-y rounded-lg border">
											{groupTxs.map((tx) => {
												const isPositive = tx.amount > 0;
												const typeConfig = transactionTypeConfig[tx.type] ?? {
													label: tx.type,
													className:
														"bg-secondary/50 text-secondary-foreground",
												};

												return (
													<div
														key={tx.id}
														className="flex items-center justify-between p-3"
													>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-2">
																<p className="truncate font-medium text-sm">
																	{tx.description ?? "Credit transaction"}
																</p>
																<Badge
																	variant="secondary"
																	className={cn(
																		"shrink-0 border-none px-1.5 py-0 text-[10px] font-normal uppercase tracking-wider",
																		typeConfig.className,
																	)}
																>
																	{typeConfig.label}
																</Badge>
															</div>
															<p className="text-muted-foreground text-[11px]">
																{format(new Date(tx.createdAt), "h:mm a")}
															</p>
														</div>
														<div className="text-right ml-4">
															<span
																className={cn(
																	"font-semibold tabular-nums text-sm",
																	isPositive
																		? "text-emerald-600 dark:text-emerald-400"
																		: "text-foreground",
																)}
															>
																{isPositive ? "+" : ""}
																{tx.amount.toLocaleString()}
															</span>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								))}
							</div>

							{/* Pagination Controls */}
							<div className="mt-4 flex items-center justify-between border-t pt-4">
								<Button
									variant="outline"
									size="sm"
									onClick={handlePrevPage}
									disabled={transactionPage === 0}
								>
									<ChevronLeftIcon className="mr-1 size-4" />
									Previous
								</Button>
								<span className="text-muted-foreground text-sm tabular-nums">
									{transactionPage * TRANSACTIONS_PER_PAGE + 1}–
									{transactionPage * TRANSACTIONS_PER_PAGE +
										transactions.transactions.length}{" "}
									of {transactions.total}
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={handleNextPage}
									disabled={!transactions.hasMore}
								>
									Next
									<ChevronRightIcon className="ml-1 size-4" />
								</Button>
							</div>
						</>
					) : (
						<EmptyText className="py-8 text-center">
							{transactionPage > 0
								? "No more transactions."
								: "No activity yet."}
						</EmptyText>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function CreditsSettingsTabSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-24 w-full" />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
